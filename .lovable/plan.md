

# Gmail Refactor: Eliminate Duplication and Create Shared Architecture

## Overview

EvansGmail.tsx (2,818 lines) and IlansGmail.tsx (711 lines) both implement Gmail inbox functionality but at vastly different levels of sophistication. This plan extracts all shared Gmail logic into reusable pieces while preserving Evan's advanced features (CRM integration, AI drafts, deal sidebar, task linking) and Ilan's simpler interface.

## Current State Analysis

| Feature | EvansGmail | IlansGmail |
|---------|-----------|-----------|
| Layout wrapper | EvanLayout | AdminLayout |
| Gmail connection check | Yes | Yes (duplicated) |
| Email fetching (inbox/sent/drafts) | Yes | Yes (duplicated) |
| Compose dialog | GmailComposeDialog (rich) | Basic Dialog (simple) |
| Sidebar | GmailSidebar component | Inline buttons |
| CRM lead matching | Yes | No |
| Mock data / avatars | Yes | No |
| "Move Forward" AI drafts | Yes | No |
| Deal sidebar panel | Yes | No |
| Inline reply box | Yes | No |
| Task creation | Yes | No |
| DraftContext persistence | Yes | No |
| URL params deep-linking | Yes | No |
| Pagination | Yes (50/page) | No |
| Email templates | Yes | No |
| Folder categories | 10 folders | 4 folders |

## Architecture After Refactor

### New File Structure

```text
src/
  hooks/
    useGmailConnection.ts        -- NEW: shared connection, fetch, send logic
  components/
    gmail/
      GmailInbox.tsx             -- NEW: shared inbox shell (<500 lines)
      GmailConnectScreen.tsx     -- NEW: shared "connect your Gmail" screen
      GmailReauthScreen.tsx      -- NEW: shared "session expired" screen
      GmailEmailList.tsx         -- NEW: shared email list renderer
      GmailEmailDetail.tsx       -- NEW: shared single-email view
      EvanGmailFeatures.tsx      -- NEW: Evan-specific features (deal sidebar, Move Forward, mock data, CRM)
  pages/admin/
    EvansGmail.tsx               -- SIMPLIFIED: thin wrapper (~80 lines)
    IlansGmail.tsx               -- SIMPLIFIED: thin wrapper (~40 lines)
```

### Step-by-step Plan

#### 1. Create `hooks/useGmailConnection.ts` -- Shared data hook

Extracts all duplicated Gmail API logic:
- Gmail connection status query (`gmail_connections` table lookup)
- Email list fetching (inbox, sent, drafts, starred -- parameterized by query)
- Send email mutation
- Connect Gmail (OAuth redirect)
- Disconnect Gmail
- Refresh / refetch helpers
- Folder count queries

Both files currently duplicate this exact pattern. The hook will accept a `userQueryPrefix` string (e.g., `'evan'` or `'ilan'`) to namespace React Query keys and avoid cache collisions.

#### 2. Create `components/gmail/GmailConnectScreen.tsx` (~40 lines)

Shared "Connect Your Gmail" and "Session Expired" screens. Both files have nearly identical versions. The component accepts:
- `onConnect`: callback to trigger OAuth
- `onDisconnect`: callback to remove connection
- `isConnecting`: loading state
- `variant`: `'connect'` or `'reauth'`

#### 3. Create `components/gmail/GmailEmailList.tsx` (~120 lines)

Shared email list rendering:
- Displays list of emails with sender name, subject, snippet, date
- Handles read/unread styling
- Star indicator
- Click to select
- Accepts optional `renderEmailActions` prop for per-user customization (e.g., Evan's "Move Forward" button, stage badges)

#### 4. Create `components/gmail/GmailEmailDetail.tsx` (~150 lines)

Shared single-email detail view:
- Back button, subject header
- Reply / Reply All / Forward buttons
- Thread message rendering (with sender avatars)
- Accepts optional `sidePanel` prop for Evan's deal sidebar
- Accepts optional `inlineReplySlot` for Evan's InlineReplyBox

#### 5. Create `components/gmail/GmailInbox.tsx` (~300 lines)

The main shared inbox shell that composes everything:
- Uses `useGmailConnection` hook
- Renders `GmailConnectScreen` when not connected
- Renders sidebar (uses existing `GmailSidebar` component for Evan, simplified version for Ilan)
- Search bar, refresh button, pagination controls
- Renders `GmailEmailList` or `GmailEmailDetail` based on selection state
- Accepts a `config` prop for user-specific behavior:

```typescript
interface GmailInboxConfig {
  userKey: string;              // 'evan' | 'ilan' -- for query key namespacing
  Layout: React.ComponentType;  // EvanLayout | AdminLayout
  sidebarType: 'full' | 'basic';
  enableMockData?: boolean;
  enableCrmIntegration?: boolean;
  enableMoveForward?: boolean;
  enableDealSidebar?: boolean;
  enableInlineReply?: boolean;
  enableTaskCreation?: boolean;
  enableDraftContext?: boolean;
  enableUrlParamsCompose?: boolean;
  enablePagination?: boolean;
  emailTemplates?: EmailTemplate[];
  folders?: FolderType[];
}
```

#### 6. Create `components/gmail/EvanGmailFeatures.tsx` (~350 lines)

Houses Evan-specific logic that doesn't belong in shared components:
- Mock external emails and thread messages (data)
- CRM lead matching logic
- "Move Forward" AI draft generation
- Deal sidebar panel content
- Next step suggestion generator
- `outbound_emails` persistence
- Task auto-completion on send

This is injected into `GmailInbox` via render props / slots.

#### 7. Simplify page files

**EvansGmail.tsx** (~80 lines): Imports `GmailInbox` with Evan's config, wraps in `EvanLayout`, passes DraftContext and URL params handling.

**IlansGmail.tsx** (~40 lines): Imports `GmailInbox` with Ilan's basic config, wraps in `AdminLayout`.

#### 8. Update routing in App.tsx

No route changes needed -- the routes already point to `EvansGmail` and `IlansGmail` which will still exist as thin wrappers. The components they render internally will change but the routes stay the same:
- `/admin/evan/gmail` renders `EvansGmail` (thin wrapper)
- `/superadmin/ilan/gmail` renders `IlansGmail` (thin wrapper)

## What Gets Extracted (Duplication Eliminated)

| Duplicated Logic | Moves To |
|-----------------|----------|
| Gmail connection query | `useGmailConnection.ts` |
| Email list fetching | `useGmailConnection.ts` |
| Send email mutation | `useGmailConnection.ts` |
| OAuth connect flow | `useGmailConnection.ts` |
| Disconnect flow | `useGmailConnection.ts` |
| "Connect Gmail" screen | `GmailConnectScreen.tsx` |
| "Session Expired" screen | `GmailConnectScreen.tsx` |
| `extractSenderName` / `extractEmailAddress` helpers | `useGmailConnection.ts` |
| `formatEmailDate` helper | `GmailEmailList.tsx` |
| Email list UI (sender, subject, snippet, date) | `GmailEmailList.tsx` |
| Email detail view (header, body, reply buttons) | `GmailEmailDetail.tsx` |
| Search filtering | `GmailInbox.tsx` |
| Sidebar + main content layout | `GmailInbox.tsx` |

## What Stays User-Specific

- **Evan only**: Mock data, CRM integration, Move Forward, deal sidebar, inline reply, task creation, DraftContext, URL params compose, email templates, outbound_emails tracking, 10 folder categories, pagination
- **Ilan only**: Basic 4-folder sidebar, simple compose dialog

## Validation Checklist

- No functionality breaks: all Evan features preserved via config + EvanGmailFeatures
- No code duplication: shared hook + shared components used by both
- GmailInbox.tsx under 500 lines (target ~300)
- Logic separated from UI (hook handles data, components handle rendering)
- Existing routes unchanged
- All existing Gmail features (compose, reply, forward, templates, CRM, AI drafts) still work

