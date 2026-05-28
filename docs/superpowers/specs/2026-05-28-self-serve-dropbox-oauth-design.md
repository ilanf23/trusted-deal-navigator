# Self-Serve Per-User Dropbox OAuth

## Problem

Dropbox OAuth is already partly implemented, but the current product surface still blocks unconnected users with a "Manual Setup Required" card. Reps should be able to connect their own Dropbox accounts without developer intervention and then link Dropbox files to CRM records, including People records.

The existing Dropbox cache table also needs stronger isolation. OAuth tokens are per user, but cached Dropbox metadata in `dropbox_files` is currently global. Any filename search, cache-backed picker, sync job, or metadata lookup must be scoped to the connected rep so one user's indexed Dropbox metadata cannot appear in another user's workflow.

## Decisions

- Dropbox remains a self-serve, per-logged-in-user OAuth integration.
- `dropbox_connections` remains the token table, keyed by Supabase auth `user_id`.
- `dropbox_files` becomes a per-user cache by adding `user_id` and scoping all cache reads/writes/searches.
- Users can connect Dropbox from the Dropbox page, Settings integrations, and the Add file Dropbox tab.
- `entity_files` remains the canonical CRM attachment table for People, deals, companies, projects, and lender programs.
- Dropbox-linked attachments remain references, not copied files. A user may see an `entity_files` row but still need Dropbox-side access through their own account to preview/open the original.
- Existing `dropbox-auth`, `dropbox-files`, `dropbox-mutations`, `dropbox-search`, and `dropbox-sync` functions are updated in place instead of introducing a new integration framework.

## User Flow

### First-Time Connection

1. A rep opens `/admin/dropbox`, `/superadmin/dropbox`, Settings -> Integrations, or an Add file dialog's Dropbox tab.
2. If the rep has no Dropbox connection, the UI shows a Connect Dropbox action instead of a manual setup message.
3. Clicking Connect Dropbox opens the existing OAuth popup.
4. Dropbox redirects to `/admin/dropbox/callback` or `/superadmin/dropbox/callback`.
5. The callback exchanges the code through `dropbox-auth`, stores tokens in `dropbox_connections`, notifies the opener, and refreshes Dropbox status.
6. The user can immediately browse Dropbox or pick a file from the Add file dialog.

### Linking Dropbox Files To People

1. A rep opens a People detail or expanded view.
2. The shared `EntityFilesSection` opens `AddFileDialog`.
3. The Dropbox tab checks the current user's connection.
4. If connected, the picker lists only the current user's Dropbox files.
5. Selecting a file inserts an `entity_files` row:
   - `entity_id`: the person record id
   - `entity_type`: `people`
   - `file_name`: Dropbox file name
   - `file_url`: Dropbox path
   - `file_type`: `dropbox`
   - `source_system`: `dropbox`
6. Opening the linked file uses the current user's Dropbox token. If the user lacks Dropbox-side access, preview/open fails without exposing another user's token.

### Disconnect

Disconnect removes only the current user's `dropbox_connections` row and deletes that user's Dropbox cache rows. It does not delete files from Dropbox and does not remove existing `entity_files` attachment references.

## Data Design

### `dropbox_connections`

Keep the existing OAuth token table:

- One row per Supabase auth `user_id`.
- Written by `dropbox-auth`.
- Read by shared Dropbox token helpers and status checks.
- The shared `getValidAccessToken(supabase, userId)` helper remains the canonical way to resolve and refresh a user's Dropbox token.

### `dropbox_files`

Make the local Dropbox metadata cache per user.

Migration requirements:

- Add `user_id uuid references auth.users(id) on delete cascade`.
- Backfill safely:
  - If exactly one Dropbox connection exists, assign existing cache rows to that `user_id`.
  - If multiple or no clear owner exists, delete old unscoped cache rows because they are only cache metadata.
- Make `user_id` non-null after backfill/cleanup.
- Replace global uniqueness on `dropbox_id` with uniqueness on `(user_id, dropbox_id)`.
- Add user-scoped indexes:
  - `(user_id, dropbox_path)`
  - `(user_id, lead_id)` where `lead_id is not null`
  - a search-supporting index that preserves current filename/content search behavior while filtering by `user_id`.
- Update RLS so users can read/manage only their own cache rows. Admin/superadmin visibility remains available for support/admin surfaces, but application queries pass `user_id` explicitly.

### `entity_files`

No schema change is required.

`entity_files` remains canonical attachment metadata and is already used by People records through `entity_type = 'people'`. Dropbox attachments store the Dropbox path in `file_url` and use `source_system = 'dropbox'`.

## Edge Function Design

### `dropbox-auth`

Keep existing actions:

- `getAuthUrl`
- `exchangeCode`
- `getStatus`
- `disconnect`

Required updates:

- Preserve OAuth callback support where the popup may not have a restored Supabase session.
- Keep storing the connection under the current Supabase auth user id.
- On connect, replace only that user's existing connection and clear that user's stale `dropbox_files` cache rows so the new account starts clean.
- On disconnect, delete only that user's connection and delete only that user's cached Dropbox metadata.

### `dropbox-files`

Required updates:

- Resolve the current user through the existing admin auth path.
- Use `getValidAccessToken(supabaseAdmin, authUserId)` for Dropbox API calls.
- Any DB-backed fallback or cache hydration must filter/write by `authUserId`.
- Return `needsAuth: true` when the current user has no Dropbox connection.

### `dropbox-mutations`

Required updates:

- Upload, move, rename, delete, and create-folder continue to use the current user's token.
- All cache upserts, updates, and deletes include `user_id = authUserId`.
- `upload-to-lead-folder` preserves existing `leadId` and `leadName` compatibility and also accepts entity-neutral aliases:
  - `entityId`
  - `entityName`
  - `entityType`
  - `companyName`
- If both legacy and entity-neutral fields are provided, `entityId` and `entityName` take precedence.
- Auto-upload folder naming can continue using the current display format for deals, while People can use the person name.

### `dropbox-search`

Required updates:

- `search-content` filters by `authUserId`.
- Any link/update operations against `dropbox_files` include `user_id = authUserId`.
- Existing `link-to-lead` can remain for compatibility, but the canonical attachment flow is `entity_files` from `AddFileDialog`.

### `dropbox-sync`

Required updates:

- Remove the current arbitrary `.limit(1).single()` connection lookup.
- Manual sync runs against the authenticated caller's Dropbox connection.
- Cache writes include the synced connection's `user_id`.
- Webhook-triggered sync must not pick an arbitrary connection. For this release, it iterates active Dropbox connections and syncs each user's cache independently.

## Frontend Design

### Dropbox Page

`src/pages/admin/Dropbox.tsx` stops rendering "Manual Setup Required." Unconnected users see a Connect Dropbox empty state backed by `useDropboxConnection`. Connected users see `DropboxBrowser` as they do today.

### Dropbox Browser

`DropboxBrowser` continues to own browsing, upload, rename, move, delete, preview, and disconnect interactions. Query keys and invalidations include the current user where results differ by connected account.

### Settings Integrations

The existing integrations page exposes a real Dropbox card. The current card using Dropbox status but labeled as Google Drive is corrected. The card will:

- Show connected/available based on the current user's Dropbox status.
- Use Connect Dropbox when disconnected.
- Navigate to the Dropbox page or expose disconnect/configure when connected.

### Add File Dialog

The Dropbox tab no longer dead-ends with "Connect Dropbox in Settings." It includes a Connect Dropbox button using `useDropboxConnection`, refreshes status after OAuth, and then lists the current user's files.

The same dialog already works for People through `EntityFilesSection`, so People support is achieved by preserving that shared path rather than building a separate People-only picker.

## Error Handling

- Missing Dropbox connection returns `needsAuth: true`; frontend shows Connect Dropbox.
- OAuth failure shows the callback error in the popup and notifies the opener.
- Missing Dropbox app scopes returns the existing missing-scope message.
- Token refresh failure is treated as reauth-needed for that user, not as a global Dropbox outage.
- File preview/open failures explain that the current Dropbox account may not have access to the linked path.
- Disconnect does not delete CRM attachment rows or original Dropbox files.

## Testing

### Build And Type Safety

- Run the project build after implementation.
- Regenerate Supabase types if migrations are applied to the active database.

### Edge Function Checks

- `dropbox-auth getStatus` returns disconnected for a user without a row.
- `dropbox-auth exchangeCode` stores only the current user's row.
- `dropbox-files list` uses the current user's token.
- `dropbox-search search-content` cannot return another user's cached rows.
- `dropbox-sync` no longer syncs an arbitrary first connection.

### UI Smoke Tests

- Unconnected Dropbox page shows Connect Dropbox.
- Settings Integrations shows Dropbox with the correct label/status.
- Add file -> Dropbox tab shows Connect Dropbox when disconnected.
- After connection, Dropbox Browser and Add file picker list files for the connected account.
- People detail/expanded view can link a Dropbox file through the shared files section.
- Disconnect hides Dropbox browsing and picker data for that user.

## Out Of Scope

- Moving Dropbox OAuth tokens into `user_integrations`.
- Shared company Dropbox.
- Copying Dropbox-linked files into Supabase storage.
- Full Dropbox content extraction/OCR improvements.
- Bulk Dropbox operations or advanced sharing permissions.
