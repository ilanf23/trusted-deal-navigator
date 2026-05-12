# Dropbox

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/dropbox` · callback: `/admin/dropbox/callback`
**Source file:** `src/pages/admin/Dropbox.tsx` (wraps `DropboxBrowser`)
**Last reviewed:** 2026-05-11

---

## Purpose

A document browser tied to the rep's personal Dropbox account. Reps store deal docs (tax returns, P&Ls, lender packages) in Dropbox and access them from inside the CRM without context-switching.

## Primary user

Sales rep collecting and organizing deal documents. Secondary: founders auditing what's been collected for a given file.

## Entry points

- Sidebar nav: **Workflow → Dropbox**
- Lead detail → *Files* tab (uses the same backend)
- OAuth return → `/admin/dropbox/callback`

## What the user can do here

- Connect a personal Dropbox account (OAuth, one-time setup)
- Browse folders and files with native-feeling navigation
- Search by filename across the account
- Upload, rename, move, and delete files
- Open files in Dropbox web for richer preview/editing

## Key business rules

- Connection is **per-user** (not shared) — each rep needs to OAuth individually
- If no connection exists, the page shows a *Manual Setup Required* card asking to contact the dev
- File metadata is cached locally in `dropbox_files` for fast search; mutations flow through edge functions and update the cache
- The router (`src/lib/dropboxRouter.ts`) decides which edge function to call based on operation type

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Connection status | `dropbox_connections` | Per-user |
| Files & folders | `dropbox_files` cache, hydrated by Dropbox API | |
| Search results | `dropbox-search` edge fn | Falls back to DB cache |

## User flows

### 1. First-time connection
1. Rep clicks **Connect Dropbox** (or visits the page without a connection)
2. Routed via `dropbox-auth` edge fn → Dropbox OAuth
3. Callback at `/admin/dropbox/callback` → tokens stored in `dropbox_connections`
4. File list loads

### 2. Find and share a file
1. Rep types a filename in search → `dropbox-search` returns matches
2. Click file → opens preview or hands off to Dropbox web

### 3. Upload from a lead's Files tab
1. From lead detail → *Files* tab → *Upload*
2. File uploaded into a lead-named folder via `dropbox-mutations`
3. `dropbox_files` cache updated

## Edge cases & known gaps

- New reps require manual OAuth setup by the dev — there's no self-serve config currently
- Cache can drift if a file is changed in Dropbox while the user is mid-session
- No bulk operations (multi-select upload, batch delete)
- Large folders (1000+ files) paginate slowly
- No granular permissions inside the CRM — anyone with the connection can do anything

---

## Technical anchors

### Components used
- `src/components/admin/DropboxBrowser.tsx`
- `src/components/employee/EmployeeLayout.tsx`

### Hooks / contexts
- `useDropbox` — file operations, router-aware
- `useDropboxConnection` — connection check + OAuth
- `useAuth`, `usePageDatabases`

### Data sources

| Table / RPC | Read | Write |
|-------------|------|-------|
| `dropbox_connections` | ✓ | (via auth fn) |
| `dropbox_files` | ✓ | ✓ (via mutations fn) |
| `dropbox-files` (edge fn) | rpc | — |
| `dropbox-mutations` (edge fn) | — | rpc |
| `dropbox-search` (edge fn) | rpc | — |
| `dropbox-auth` (edge fn) | rpc | rpc |

### Edge functions
- `dropbox-auth` — OAuth flow
- `dropbox-files` — list/get folders
- `dropbox-mutations` — upload/move/rename/delete
- `dropbox-search` — full-text filename search

### Permissions
- Route gate: `AdminRoute`
- Only the connecting rep can operate on their own Dropbox

## Open questions

- [ ] Self-serve OAuth setup (no dev intervention)?
- [ ] Shared team Dropbox (single account, multi-user access)?
- [ ] Cache invalidation strategy when Dropbox changes outside the CRM?
- [ ] Bulk upload UX (drag-multiple, batch attach to lead)?
