# Google OAuth Unification

Unify three separate Google OAuth integrations (Calendar, Sheets, Gmail) into a single connection per user.

## Problem

The codebase has three nearly identical OAuth flows:

- **3 database tables** (`calendar_connections`, `gmail_connections`, `sheets_connections`) sharing 5 identical columns
- **3 OAuth edge functions** (`google-calendar-auth`, `google-sheets-auth`, `gmail-auth`) with the same 4 actions
- **5 duplicate token-refresh implementations** across inline functions and shared utilities
- **Inconsistent API patterns** across the three flows (action in body vs query params, different response shapes, different auth checks)
- **Legacy `user_name` column** on calendar/sheets tables that is unused

Users always connect with the same Google account, so there is no reason for separate flows.

## Decisions

- **One consent, all scopes:** A single OAuth consent screen requests Calendar + Sheets + Gmail + Drive permissions together.
- **One row per user:** `user_id` is unique in the new table. No per-provider rows.
- **`user_name` dropped:** Legacy column, not needed.
- **`requireAdmin` auth pattern:** All actions use the `_shared/auth.ts` helper (consistent with Gmail's current approach).

## Design

### 1. Unified Database Table

**Table: `google_connections`**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid (PK) | No | Default `gen_random_uuid()` |
| `user_id` | uuid (unique) | No | Auth user ID, one row per user |
| `email` | varchar | No | Google account email |
| `access_token` | text | No | OAuth access token |
| `refresh_token` | text | No | OAuth refresh token |
| `token_expiry` | timestamptz | No | When access_token expires |
| `scopes` | text | Yes | Granted scopes (space-separated) |
| `calendar_id` | text | Yes | Google Calendar ID (default 'primary') |
| `drive_watch_channel_id` | text | Yes | Drive watch channel UUID |
| `drive_watch_channel_token` | text | Yes | Drive watch per-channel secret |
| `drive_watch_resource_id` | text | Yes | Drive watch resource ID |
| `drive_watch_expiry` | timestamptz | Yes | Drive watch expiration |
| `drive_watch_spreadsheet_id` | text | Yes | Watched spreadsheet ID |
| `created_at` | timestamptz | No | Default `now()` |
| `updated_at` | timestamptz | No | Default `now()` |

RLS policies: users can read their own row, service role for writes.

### 2. Shared Token Refresh Utility

**New file: `supabase/functions/_shared/googleToken.ts`**

Single function replacing all 5 implementations:

```
getValidGoogleAccessToken(supabase, userId) -> { accessToken, email } | null
```

- Reads from `google_connections` by `user_id`
- Returns current token if expiry > 5 minutes away
- Otherwise refreshes via `https://oauth2.googleapis.com/token`, updates the row, returns new token
- Returns `null` if no connection or refresh fails

**Files deleted:**
- `_shared/googleTokenRefresh.ts`
- `_shared/gmailToken.ts`

**Files updated to use new utility:**
- `google-calendar-sync/index.ts` (remove inline `getValidAccessToken`)
- `google-sheets-sync/index.ts` (remove inline `getValidAccessToken`)
- `google-sheets-api/index.ts` (remove inline `getValidAccessToken`)
- `_shared/gmail/api.ts` (update `getValidAccessToken` to delegate to shared utility)
- `sheets-watch-start/index.ts`
- `sheets-watch-stop/index.ts`

### 3. Unified `google-auth` Edge Function

**New file: `supabase/functions/google-auth/index.ts`**

Replaces `google-calendar-auth`, `google-sheets-auth`, and `gmail-auth`.

Four actions, all via JSON body:

| Action | Input | Output |
|---|---|---|
| `getAuthUrl` | `{ redirectUri }` | `{ authUrl }` |
| `exchangeCode` | `{ code, redirectUri }` | `{ success, email }` |
| `getStatus` | (none) | `{ connected, email, calendarId }` |
| `disconnect` | (none) | `{ success }` |

**Combined OAuth scopes:**
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/userinfo.email`
- `profile`

Auth: `requireAdmin` from `_shared/auth.ts`. Rate limit: 60 requests per 60 seconds.

**Edge functions deleted:**
- `supabase/functions/google-calendar-auth/`
- `supabase/functions/google-sheets-auth/`
- `supabase/functions/gmail-auth/`

### 4. Frontend Changes

**Unified callback page: `src/pages/admin/GoogleCallback.tsx`**

- Routes: `/admin/google-callback`, `/superadmin/google-callback`
- Exchanges auth code with `google-auth` edge function
- Posts message back to opener via `postMessage`
- localStorage key: `google-auth-result`

**Callback pages deleted:**
- `src/pages/admin/CalendarCallback.tsx`
- `src/pages/admin/SheetsCallback.tsx`
- `src/pages/admin/InboxCallback.tsx`

**Hook updates:**

| Hook | Changes |
|---|---|
| `useCalendarData` | Call `google-auth` instead of `google-calendar-auth`. Update localStorage key and callback path. |
| `useGoogleSheets` | Call `google-auth` instead of `google-sheets-auth`. Update callback path. |
| `useGmailConnection` | Call `google-auth` instead of `gmail-auth`. Query `google_connections` instead of `gmail_connections`. |

**Direct table reads (7 components updating `gmail_connections` -> `google_connections`):**
- `LeadDetailDialog.tsx`
- `PipelineExpandedView.tsx`
- `UnderwritingExpandedView.tsx`
- `LenderManagementExpandedView.tsx`
- `LenderExpandedView.tsx`
- `ProjectDetailPanel.tsx`
- `IntegrationsSection.tsx`

**Route updates in `App.tsx`:**
- Remove old callback routes (`/admin/calendar-callback`, `/admin/sheets-callback`, `/admin/inbox-callback` and superadmin equivalents)
- Add `/admin/google-callback` and `/superadmin/google-callback`

### 5. Migration Strategy

Two separate migrations for rollback safety:

**Migration 1 — Create and backfill:**
1. Create `google_connections` table with schema above
2. For each `user_id` across the 3 old tables, insert one row:
   - Take `access_token`, `refresh_token`, `token_expiry`, `email` from the row with the most recent `updated_at`
   - Merge `calendar_id` from `calendar_connections`
   - Merge `drive_watch_channel_token` from `sheets_connections`
   - Set `scopes` to the full combined scope string
3. Add RLS policies
4. Add unique index on `user_id`

**Migration 2 — Drop old tables (after verification):**
1. Drop `calendar_connections`
2. Drop `gmail_connections`
3. Drop `sheets_connections`

## Full Deletion List

| File | Reason |
|---|---|
| `supabase/functions/google-calendar-auth/` | Replaced by `google-auth` |
| `supabase/functions/google-sheets-auth/` | Replaced by `google-auth` |
| `supabase/functions/gmail-auth/` | Replaced by `google-auth` |
| `supabase/functions/_shared/googleTokenRefresh.ts` | Replaced by `googleToken.ts` |
| `supabase/functions/_shared/gmailToken.ts` | Replaced by `googleToken.ts` |
| `src/pages/admin/CalendarCallback.tsx` | Replaced by `GoogleCallback.tsx` |
| `src/pages/admin/SheetsCallback.tsx` | Replaced by `GoogleCallback.tsx` |
| `src/pages/admin/InboxCallback.tsx` | Replaced by `GoogleCallback.tsx` |

## Consumer Impact Summary

| Entity Type | Count | Action |
|---|---|---|
| Edge functions (auth) | 3 deleted, 1 new | Replace 3 auth functions with unified `google-auth` |
| Edge functions (sync/API) | 5 updated | Change table references and import shared token utility |
| Shared utilities | 2 deleted, 1 new | Replace 2 provider-specific utilities with `googleToken.ts` |
| React hooks | 3 updated | Change edge function calls and table references |
| Components (direct reads) | 7 updated | Change `gmail_connections` to `google_connections` |
| Callback pages | 3 deleted, 1 new | Replace 3 callback pages with `GoogleCallback.tsx` |
| Routes in App.tsx | Updated | Swap old callback routes for new one |
| Database tables | 3 dropped, 1 new | After verification period |
