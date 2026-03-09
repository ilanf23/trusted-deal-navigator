
Problem confirmed: the Dropbox OAuth exchange is failing in the backend with a foreign-key error, not at Dropbox. Recent logs show:
- `dropbox_connections_user_id_fkey` violation
- attempted `user_id = 00000000-0000-0000-0000-000000000000`

That means the popup callback is reaching `exchangeCode`, but when no auth session is present in the popup, the function inserts a placeholder UUID and fails.

Implementation plan

1) Fix user identity flow in OAuth callback
- File: `src/pages/admin/DropboxCallback.tsx`
- Parse `state` from the Dropbox callback URL (`?state=...`) in addition to `code`.
- Send `state` to `dropbox-auth` during `exchangeCode`.
- Keep `getSession()` as best-effort, but no longer depend on popup auth session to determine user id.

2) Remove invalid UUID fallback in backend exchange
- File: `supabase/functions/dropbox-auth/index.ts`
- Make only `exchangeCode` public; keep `getStatus` authenticated again (to avoid exposing connection metadata).
- In `exchangeCode`, resolve `effectiveUserId` as:
  - authenticated user id (if auth header/session exists), else
  - user id from OAuth `state`.
- Validate `effectiveUserId` before insert (must be a valid UUID and correspond to a real app user/admin).
- Replace:
  - `user_id: userId || '00000000-0000-0000-0000-000000000000'`
  with:
  - `user_id: effectiveUserId`
- If user id cannot be resolved, return a clear 400 error (no insert attempt).

3) Improve user-facing failure visibility
- File: `src/pages/admin/DropboxCallback.tsx`
- Surface backend error reason in the popup message (instead of generic “Failed to connect Dropbox”).
- Emit `DROPBOX_ERROR` with a readable message so the opener can show a meaningful toast.

4) Improve parent-window feedback
- File: `src/hooks/useDropboxConnection.ts`
- Handle `DROPBOX_ERROR` messages in both `postMessage` and `storage` listeners.
- Show `toast.error(...)` with the callback-provided message and keep status unchanged.

Technical details (for implementation accuracy)

- Root cause is deterministic from logs: FK failure on `dropbox_connections.user_id` during `exchangeCode`.
- Current backend behavior allows public `exchangeCode`, but still needs a valid user id for required FK column.
- OAuth `state` is already set in `getAuthUrl` (`state = userId`) and should be used as fallback identity channel for popup flows where local session restoration is unreliable.
- No database migration needed; schema is correct (`user_id` should stay required).
- Security hardening included: do not keep `getStatus` public.

Validation checklist after implementation

1. Start from `/admin/dropbox`, click Connect, approve in Dropbox.
2. Popup should show Connected (not Failed), then close/redirect.
3. `dropbox_connections` should contain one row with a real `user_id` (no zero UUID).
4. Main Dropbox screen should display connected email and allow listing/sync.
5. Re-test in both preview and published domains to confirm callback stability.
