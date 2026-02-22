

## Refactor: Decompose EvansGmail.tsx (2248 lines) into Reusable Modules

### Current State

| File | Lines | Status |
|------|-------|--------|
| `src/pages/admin/EvansGmail.tsx` | 2,248 | Monolithic -- needs decomposition |
| `src/pages/admin/IlansGmail.tsx` | 99 | Already clean -- uses shared `GmailInbox` |
| `src/components/gmail/GmailInbox.tsx` | 287 | Shared shell -- used by Ilan only |

### Why EvansGmail Can't Simply Become `<GmailInbox userId="evan" />`

After a full audit, EvansGmail contains **1,800+ lines of Evan-specific CRM logic** that does not exist in the shared GmailInbox:

- AI "Move Forward" draft generation with `outbound_emails` persistence
- CRM lead matching and deal sidebar (contacts, phones, emails, pipeline stage editing)
- URL-param compose handling with `DraftContext` for cross-page navigation
- Inline reply with local thread state and task auto-completion
- Mock external emails mixed into real inbox
- 7-day follow-up filtering and CRM category folders
- Pagination with page controls
- Email templates view
- Task creation dialog from email context
- Lead/pipeline mutations from the sidebar

Forcing all of this through render props on `GmailInbox` would make the config object larger than the current file. Instead, we decompose EvansGmail into focused modules.

### Refactor Strategy

**Extract 4 files, reduce EvansGmail to ~150 lines.**

```text
BEFORE:
  EvansGmail.tsx (2,248 lines) -- everything in one file

AFTER:
  EvansGmail.tsx              (~150 lines)  -- thin wrapper, imports + JSX orchestration
  useEvansGmailLogic.ts       (~500 lines)  -- all state, queries, mutations, handlers
  EvansGmailEmailList.tsx     (~250 lines)  -- email list rows with CRM badges
  EvansGmailEmailDetail.tsx   (~600 lines)  -- email detail view with thread, inline reply, deal sidebar
  EvansGmailDealSidebar.tsx   (~350 lines)  -- lead info panel (contacts, phones, emails, stage)
```

### File-by-File Plan

**1. `src/hooks/useEvansGmailLogic.ts` (NEW -- ~500 lines)**

Extracts ALL business logic from EvansGmail:
- All `useState` declarations (selectedEmailId, activeFolder, searchQuery, compose state, etc.)
- All `useQuery` calls (allLeads, crmEmails, pipelineStages)
- All `useMutation` calls (updateLeadMutation, updateStageMutation)
- `useGmailConnection` initialization
- `useDraft` context consumption
- URL-param compose `useEffect` handlers
- `handleMoveForward`, `handleSendEmail`, `handleReply`, `handleConnectGmail`
- `handleSelectEmail`, `handleMarkUnread`
- `filteredEmails`, `paginatedEmails`, `folderCounts` memos
- `findLeadForEmail`, `isExternalEmail` wrappers
- Inline reply send handler
- Returns all state + handlers as a typed object

**2. `src/components/evan/gmail/EvansGmailEmailList.tsx` (NEW -- ~250 lines)**

Extracts the email list rendering (currently lines 2017-2189):
- Email row with avatar, sender name, subject, snippet
- CRM badges (pipeline stage, loan amount, last touch, stage age)
- "Move Forward" button on external emails
- Next step suggestion text
- Star toggle, dropdown menu (mark unread, add task)
- Read/unread styling
- Accepts props: emails, handlers, state from the hook

**3. `src/components/evan/gmail/EvansGmailEmailDetail.tsx` (NEW -- ~600 lines)**

Extracts the full email detail view (currently lines 1184-1981):
- Thread message rendering (mock threads + local replies)
- Single email fallback rendering
- Reply/Reply All/Forward action bar
- "Add Task" and "Show Lead Info" buttons
- Inline reply box integration
- Reply All bottom bar
- Accepts the deal sidebar as a slot/child

**4. `src/components/evan/gmail/EvansGmailDealSidebar.tsx` (NEW -- ~350 lines)**

Extracts the deal/lead sidebar panel (currently lines 1650-1981):
- Lead name, company, pipeline stage selector
- Priority and contact type selectors
- Contacts list
- Phone numbers list
- Email addresses list
- "Move Forward" action button
- Notes section
- Accepts lead data + mutation handlers as props

**5. `src/pages/admin/EvansGmail.tsx` (MODIFIED -- reduced to ~150 lines)**

Becomes a thin orchestrator:
```tsx
const EvansGmail = () => {
  const logic = useEvansGmailLogic();

  if (logic.connectionLoading) return <EvanLayout>...</EvanLayout>;
  if (!logic.gmailConnection) return <EvanLayout>...</EvanLayout>;

  return (
    <EvanLayout>
      {logic.isGeneratingEmail && <GeneratingOverlay />}
      <div className="flex h-[calc(100vh-100px)] ...">
        <GmailSidebar ... />
        <div className="flex-1 flex flex-col">
          <EvansGmailToolbar ... />
          {logic.selectedEmail ? (
            <EvansGmailEmailDetail ... />
          ) : logic.activeFolder === 'templates' ? (
            <EvansGmailTemplates ... />
          ) : (
            <EvansGmailEmailList ... />
          )}
        </div>
      </div>
      <GmailComposeDialog ... />
      <LeadDetailDialog ... />
      <GmailTaskDialog ... />
    </EvanLayout>
  );
};
```

**6. `src/pages/admin/IlansGmail.tsx` -- NO CHANGES**

Already 99 lines and uses the shared `GmailInbox`. No modification needed.

**7. `src/components/gmail/GmailInbox.tsx` -- NO CHANGES**

Stays as the lightweight shared shell for simple Gmail views.

### What This Preserves (Zero Functional Changes)

- All Supabase queries remain identical (same tables, same selects, same filters)
- All mutations remain identical (leads, pipeline_leads, evan_tasks, lead_tasks, outbound_emails)
- All Gmail API calls remain identical (same edge function, same payloads)
- URL-param compose handling stays identical (DraftContext integration)
- Inline reply with local thread state stays identical
- Mock emails mixed into inbox stays identical
- All event handlers and side effects stay identical
- Component tree hierarchy stays identical (EvanLayout wraps everything)
- Routing stays identical (no route changes)

### Summary

| Metric | Before | After |
|--------|--------|-------|
| EvansGmail.tsx | 2,248 lines | ~150 lines |
| IlansGmail.tsx | 99 lines | 99 lines (unchanged) |
| Total new files | 0 | 4 |
| Duplicated Gmail logic | ~0 (different implementations) | ~0 |
| Functional changes | -- | Zero |
| API/query changes | -- | Zero |
| Route changes | -- | Zero |

