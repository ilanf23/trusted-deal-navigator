
Goal: restore reliable Dropbox connection first, then make Dropbox page actions (upload/folder ops) consistently work without generic failures.

What I found (from code + backend logs):
- Current failure is at OAuth token save, not at redirect:  
  `null value in column "email" of relation "dropbox_connections" violates not-null constraint`
- This happens in `dropbox-auth` after token exchange because account metadata is assumed valid and inserted without validating `get_current_account` success/shape.
- The disconnected Dropbox screen is also firing `dropbox-api list` immediately, which creates noisy “Edge Function returned non-2xx status code” errors before a connection exists.
- Earlier `dropbox-api` logs also show upload header encoding issues (`headers ... not a valid ByteString`) for some filenames/paths.

Implementation plan:

1) Fix Dropbox connection handshake robustness (`supabase/functions/dropbox-auth/index.ts`)
- Validate `tokenResponse.ok` before using token JSON.
- Call `users/get_current_account` with explicit JSON request format; check `accountResponse.ok` and parse Dropbox error safely.
- Resolve persisted identity fields safely:
  - `account_id`: use account response, fallback to token payload if present.
  - `email`: use account email when available; fallback to authenticated app user email (from verified user/admin lookup) if Dropbox omits it.
- If no usable identifier can be resolved, return a clear 400 with actionable reconnect guidance (no DB insert attempt).
- Keep `exchangeCode` public (popup-safe), keep other actions authenticated, and add explicit admin-role enforcement for connect/disconnect/status endpoints (company-wide connection hardening).

2) Prevent false Dropbox API calls while disconnected (frontend)
- Update `useDropboxList` to support an `enabled` flag.
- In `DropboxBrowser`, only run list query when `isConnected === true`.
- This removes the immediate non-2xx toast on the “Connect Dropbox” screen and avoids confusing failure loops.

3) Improve callback error surfacing (`src/pages/admin/DropboxCallback.tsx`)
- Parse edge-function error payloads (not just generic invoke error text) so popup/parent receives the real reason (e.g., account metadata failure vs missing scope vs redirect mismatch).
- Keep existing `DROPBOX_ERROR` propagation to parent + storage fallback.

4) Fix upload header compatibility for all filenames (`supabase/functions/dropbox-api/index.ts`)
- Ensure `Dropbox-API-Arg` header is safely encoded for non-ASCII characters in paths/names to avoid Deno ByteString header failures.
- Keep existing action handlers; this specifically stabilizes upload for real-world file names.

5) Validate end-to-end after changes
- Reconnect Dropbox from `/admin/dropbox` and confirm success state.
- Confirm `dropbox_connections` row is created with valid `user_id`, token fields, and resolved account identity fields.
- Verify UI actions: list, upload, new folder, rename/move, delete, temporary link.
- Retest with at least one filename containing special characters.
- Confirm no generic “non-2xx” toast appears on disconnected screen.

Technical notes:
- No schema migration required for this pass unless Dropbox account identity proves structurally unavailable across account types; if that appears during verification, fallback plan is a targeted migration to relax `dropbox_connections.email` nullability and render a non-email account label in UI.
- Existing RLS posture for Dropbox tables is already admin-scoped; function-level admin checks will close remaining access gaps on shared connection actions.
