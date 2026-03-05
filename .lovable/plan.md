

## Plan: Fix Dropbox OAuth Callback Auth Failure

### Root Cause
The popup window navigates away to `dropbox.com` for authorization, then Dropbox redirects back to `/admin/dropbox/callback`. When the React app loads fresh in the popup, the Supabase client hasn't finished restoring the session from `localStorage` yet. The `useEffect` fires immediately and calls `supabase.functions.invoke('dropbox-auth', { body: { action: 'exchangeCode' } })` — but without a session, no `Authorization` header is sent. The edge function sees no auth header and returns 401 silently (no logs).

### Fix (two changes)

**1. Edge function: Skip auth for `exchangeCode` action** (`supabase/functions/dropbox-auth/index.ts`)
The `exchangeCode` action doesn't need user authentication — it's just exchanging a Dropbox OAuth code for tokens using server-side secrets. Parse the request body first, and if the action is `exchangeCode`, skip the auth check entirely. Use the service role key directly (already done for the DB insert). This also applies to `getStatus` which is read-only.

**2. Callback page: Wait for session before other actions** (`src/pages/admin/DropboxCallback.tsx`)
As a safety net, add a brief session-restore wait before calling the edge function. Use `supabase.auth.getSession()` first to ensure the client has initialized, then proceed. This protects future actions that do require auth.

### What stays the same
- The `connect`, `disconnect` actions still require auth (user-initiated from the main window where session exists)
- No frontend routing or component changes needed
- No database changes needed

