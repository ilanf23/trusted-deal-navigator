# Expanded-View Files Section (shared pattern)

**Status:** live
**Portal:** Sales Rep (also used by Super Admin views)
**Route:** N/A — sub-section embedded in every entity's detail panel + expanded view
**Source file:** `src/components/admin/files/EntityFilesSection.tsx`
**Last reviewed:** 2026-05-15

---

## Purpose

A single Files section that appears in every entity's right-rail / detail layout — Pipeline / Underwriting / Lender Management / People / Companies / Projects / Lender Programs. Reps attach files to whatever record they're working on, pulled from three places: their computer, their Dropbox, or their Google Sheets — all stored in a single `entity_files` table keyed by entity type.

## Primary user

Sales rep working a deal or contact, who needs a doc (P&L, term sheet, signed contract, lender package, spreadsheet) bound to that specific record without context-switching to Dropbox / Drive.

## Entry points

The section is rendered inside every right-rail "related" sidebar / detail panel:

| Surface | Component | Entity type |
|---|---|---|
| Potential expanded view | `LeadRelatedSidebar` (via `PipelineExpandedView`) | `potential` |
| Underwriting expanded view | `LeadRelatedSidebar` (via `UnderwritingExpandedView`) | `underwriting` |
| Lender Management expanded view | `LeadRelatedSidebar` (via `LenderManagementExpandedView`) | `lender_management` |
| Pipeline detail panel | `PipelineDetailPanel` | `potential` |
| Underwriting detail panel | `UnderwritingDetailPanel` | `underwriting` |
| People expanded view | `PeopleExpandedView` (Collapsible) | `people` |
| People detail panel | `PeopleDetailPanel` | `people` |
| Company expanded view | `CompanyExpandedView` | `companies` |
| Company detail panel | `CompanyDetailPanel` (Collapsible) | `companies` |
| Project expanded view | `ProjectExpandedView` | `potential` (project shares the lead's id) |
| Project detail panel | `ProjectDetailPanel` | `potential` |
| Lender Program expanded view | `LenderExpandedView` | `lender_programs` |
| Lead Detail dialog | `LeadDetailDialog` (Files tab) | `potential` |

## What the user can do here

- See every file attached to this record (newest first)
- **Add a file** via a tabbed dialog — Computer / Dropbox / Google Sheets
  - Computer: native upload to Supabase storage (`lead-files` bucket); if Dropbox is connected, the file is auto-synced to a record-named Dropbox folder
  - Dropbox: pick from the rep's connected Dropbox; only the **link** is stored (no copy)
    The picker and local cache are scoped to the current connected rep.
  - Google Sheets: pick a spreadsheet from the rep's connected Drive; only the **link** is stored
- Open a file (signed-URL preview dialog for native, dedicated viewer for sheets/dropbox)
- Download native files (60s signed URL)
- Delete: native files are removed from storage; Dropbox/Sheets links are just unlinked (originals untouched)

## Key business rules

- **One canonical store:** all attachments — uploaded, linked from Dropbox, linked from Sheets — live in `entity_files`, distinguished by `source_system` (`native` / `dropbox` / `google_sheets`)
- **One canonical UI:** every surface uses `EntityFilesSection`. No surface should re-implement upload / delete / download
- **One canonical cache key:** `['entity-files', entityType, entityId]` is shared between the section, the surrounding RelatedSection's count badge, and any other consumer — so an upload in one panel updates the count in any other open view of the same record
- **Per-user Dropbox** (post 2026-05-15): when picking from Dropbox, the rep sees **their own** account's files. (See [dropbox.md](./dropbox.md) for the prior multi-tenant bug and fix.)
- **Per-user Google Sheets:** same model — each rep OAuths their own Google account; tokens stored in `sheets_connections` keyed by `user_name`
- **No undo on file delete** — storage removal is irreversible

## Data shown

| Field | Source | Notes |
|---|---|---|
| File icon | derived from `file_name` extension | `.xls/.xlsx/.csv` → spreadsheet, images → image, etc. |
| Source badge | `entity_files.source_system` | `Uploaded` / `Dropbox` / `Google Sheets` |
| File name | `entity_files.file_name` | |
| Size | `entity_files.file_size` | Native uploads only |
| Age | `entity_files.created_at` | "N hours ago" |

## User flows

### 1. Upload a P&L from computer
1. Rep opens a Potential deal expanded view
2. Clicks **+** on the Files section header (right rail)
3. AddFileDialog opens on the **Computer** tab
4. Drops file → uploaded to Supabase storage `lead-files/${entityId}/${uuid}_${safeName}`
5. Row inserted into `entity_files` with `source_system = 'native'`
6. If Dropbox connected: file is also synced to a record-named Dropbox folder (toast: "Synced to Dropbox")
7. File appears in the list with size + age

### 2. Link a Dropbox file
1. Rep clicks **+** → switches to **Dropbox** tab
2. Search filters their Dropbox files (only **their** account, see fix below)
3. Clicks a file → row inserted with `source_system = 'dropbox'`, `file_url = Dropbox path`
4. Clicking the row opens `DropboxViewerDialog`

### 3. Link a Google Sheet
1. Rep clicks **+** → **Google Sheets** tab
2. If not connected to Dropbox or Google, sees the relevant Connect CTA → OAuth popup → unified callback saves tokens
3. Picks a sheet → row inserted with `source_system = 'google_sheets'`, `file_url = spreadsheet ID`
4. Clicking the row opens `SheetViewerDialog`

## Edge cases & known gaps

- **`ProjectDetailDialog` and `VolumeLogExpandedView`** don't have a Files section — Volume Log's entity type isn't supported by the `entity_type` enum
- **`LenderDetailPanel`** has no related-sections sidebar, so no Files section
- Deleting a Dropbox-linked record removes the row in `entity_files` but does **not** delete the original in Dropbox
- Native uploads larger than the user's storage quota fail with the raw Supabase error toast

---

## Technical anchors

### Components used

- `src/components/admin/files/EntityFilesSection.tsx` — list UI + preview / download / delete; owns the React Query cache for `['entity-files', entityType, entityId]`
- `src/components/admin/files/AddFileDialog.tsx` — 3-tab picker (Computer / Dropbox / Google Sheets)
- `src/components/admin/files/SheetViewerDialog.tsx` — Sheets viewer
- `src/components/admin/files/DropboxViewerDialog.tsx` — Dropbox viewer
- `src/components/admin/files/types.ts` — `EntityType`, `FileSourceSystem`, `EntityFile`

### Canonical wrapping pattern (parent surface)

The Files section uses **either** a `RelatedSection` (right-rail sidebars) **or** a `Collapsible` (detail panels). When a parent wraps EFS and wants to drive the "+" button itself, it passes controlled props:

```tsx
const [addFilesOpen, setAddFilesOpen] = useState(false);
const { data: files = [] } = useQuery({
  queryKey: ['entity-files', 'potential', lead.id], // shared cache
  queryFn: async () => { /* same select shape as EFS */ },
});

<RelatedSection
  label="Files"
  count={files.length}
  onAdd={() => setAddFilesOpen(true)}
>
  <EntityFilesSection
    entityId={lead.id}
    entityType="potential"
    hideHeader
    addOpen={addFilesOpen}
    onAddOpenChange={setAddFilesOpen}
  />
</RelatedSection>
```

If a parent does **not** wire `onAdd`, EFS still shows its own internal "Add file" button — the picker is always reachable.

### Props (`EntityFilesSection`)

| Prop | Type | Purpose |
|---|---|---|
| `entityId` | `string` | Record ID |
| `entityType` | `EntityType` | `'potential' \| 'underwriting' \| 'lender_management' \| 'people' \| 'companies' \| 'lender_programs' \| 'pipeline'` |
| `entityName` | `string?` | Used when auto-syncing native uploads into a Dropbox folder |
| `companyName` | `string?` | Used for Dropbox folder naming |
| `hideHeader` | `boolean?` | Skip the internal "X files" + "Add file" row (parent owns the header) |
| `addOpen` | `boolean?` | Controlled state — parent owns the dialog open/close |
| `onAddOpenChange` | `(open) => void?` | Controlled state setter |

### Hooks / contexts

- `useDropboxAutoUpload(dropboxConnected)` — auto-syncs native uploads to record-named Dropbox folders
- `useGoogleSheets(teamMemberName, redirectPath)` — connection check + OAuth flow
- `useTeamMember()` — current user's team-member row (used to attribute uploads + scope Sheets connection)

### Data sources

| Table / bucket / fn | Read | Write |
|---|---|---|
| `entity_files` (table) | ✓ | ✓ |
| `lead-files` (storage bucket) | ✓ (signed URL preview/download) | ✓ (native upload) |
| `dropbox_connections` | (via edge fn) | — |
| `sheets_connections` | (via edge fn) | — |
| `dropbox-auth` (edge fn) | rpc | — |
| `dropbox-files` (edge fn) | rpc | — |
| `dropbox-mutations` (edge fn) | — | rpc (auto-sync) |
| `google-sheets-auth` (edge fn) | rpc | rpc |
| `google-sheets-api` (edge fn) | rpc | — |

### `entity_files` schema

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `entity_id` | `uuid` | FK to whichever pipeline / people / company / etc. row this belongs to |
| `entity_type` | `entity_type` enum | Discriminator for `entity_id` |
| `file_name` | `text` | Display name |
| `file_url` | `text` | Native → storage path; Dropbox → path; Google Sheets → spreadsheet ID |
| `file_type` | `text?` | MIME for native; `'dropbox'` / `'google_sheets'` placeholder for linked |
| `file_size` | `bigint?` | Native only |
| `uploaded_by` | `text?` | Team-member name |
| `source_system` | `text` (NOT NULL, default `native`) | `'native' \| 'dropbox' \| 'google_sheets'` |
| `created_at` | `timestamptz` | |

### Edge functions

- `dropbox-auth` — per-user OAuth flow, callback at `/admin/dropbox/callback`
- `dropbox-files` — `list` / `list-recursive` / `download` / `get-temporary-link`; now scoped per-caller via `getValidAccessToken(supabase, userId)`
- `dropbox-mutations` — `upload` / `upload-to-lead-folder` / `move` / `rename` / `delete`; also per-caller scoped
- `google-sheets-auth` — per-user OAuth, callback at `/admin/sheets-callback`
- `google-sheets-api` — `listSpreadsheets` / `getSheets` / `getData` / `updateCell` / `appendRow`

### Permissions

- All rows in `entity_files` are admin-visible (RLS allows admin/super_admin reads + writes); enforcement is at the route level (`AdminRoute`)
- Dropbox token is the connecting rep's only; they cannot see another rep's files via the picker
- Sheets token is the connecting rep's only; same model

## Changelog

- **2026-05-15** — Unified pattern rollout
  - Added `hideHeader`, `addOpen`, `onAddOpenChange` to `EntityFilesSection` so parent `RelatedSection` can own the header `+` button
  - Wired all canonical surfaces (Pipeline / Underwriting / Company / People / Project / Lender expanded views + detail panels) to use the shared cache key `['entity-files', entityType, entityId]`
  - `LenderExpandedView`: replaced "No files" placeholder with real picker (entity type `lender_programs`)
  - `LeadRelatedSidebar`: replaced its legacy local-only file UI with embedded `EntityFilesSection` — the Pipeline / Underwriting / Lender Management right rail now offers all three sources
  - Removed legacy `handleFileUpload` / `handleDeleteFile` / `handleDownloadFile` / `fileInputRef` / `PersonFile` / `LeadFile` from `PeopleExpandedView`, `PeopleDetailPanel`, `ProjectExpandedView` (net −582 LOC across changed files)
  - Fixed `AddFileDialog` Sheets OAuth redirect (`/admin/settings` → `/admin/sheets-callback`)
  - Fixed Dropbox per-user token scoping in shared helper (see [dropbox.md](./dropbox.md))

## Open questions

- [ ] Add a Files surface to `VolumeLogExpandedView`? Would need a new value in the `entity_type` enum
- [ ] Add a Files surface to `LenderDetailPanel`? Currently no related-sections sidebar there
- [ ] Bulk upload / multi-file picker on the Computer tab
- [ ] Should deleting a Dropbox-linked row offer to also delete the original?
