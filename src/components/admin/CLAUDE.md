# Admin Components

105 components for the admin/superadmin portal — the largest feature set in the app.

## Structure

### Top-Level Components (59 files)

**Layout & Routing:**
- `AdminLayout.tsx`, `AdminRoute.tsx`, `AdminRouteLayout.tsx` — layout wrappers
- `AdminSidebar.tsx` — role-aware sidebar (Ilan-specific, owner, employee sections)
- `AdminPortalWrapper.tsx` — wraps admin routes with persistent call state
- `EmployeeRoute.tsx` — per-employee route guard

**Detail Panels (Expanded View + Detail Panel pairs):**
- `PeopleExpandedView` / `PeopleDetailPanel` — CRM people management
- `CompanyExpandedView` / `CompanyDetailPanel` — CRM company management
- `LenderManagementExpandedView` — lender tracking
- `LenderExpandedView` / `LenderDetailPanel` — lender programs CRM detail view
- `PipelineExpandedView` / `PipelineDetailPanel` — deal pipeline
- `ProjectExpandedView` / `ProjectDetailDialog` — project tracking
- `UnderwritingExpandedView` / `UnderwritingDetailPanel` — underwriting pipeline
- `VolumeLogExpandedView` — loan volume

**Dialogs/Modals:**
- `LeadDetailDialog` — full lead management (multi-tab, ~146KB)
- `PeopleTaskDetailDialog`, `GmailTaskDialog` — task-specific
- `CreateFilterDialog`, `CreatePipelineModal`, `StageManagerModal` — pipeline config
- `PipelineSettingsDialog`, `PipelineSharingModal` — pipeline admin
- `ColumnManagerModal`, `MoveBoxesModal`, `ChecklistBuilder` — utilities

**Pipeline Components:**
- `PipelineColumnHeader`, `ResizableColumnHeader` — board UI
- `PipelineBulkToolbar`, `SelectAllHeader` — bulk operations
- `InlineEditableCell`, `InlineEditableFields` — data display/edit

**Floating UI:**
- `FloatingBugReport`, `FloatingInbox` — persistent overlay tools

**Integration:**
- `DropboxBrowser` — Dropbox file management
- `GmailComposeDialog` — email composition
- `AIEmailAssistant`, `AIEmailAssistantSheet` — AI-powered email
- `LenderProgramAssistant` — AI lender matching

### Subdirectories

**`ai-changes/`** (4 files) — AI change tracking: table, filters, diff view, detail panel

**`dashboard/`** — Admin dashboard:
- `useDashboardData.ts` — data hook for all dashboard metrics

**`dropbox/`** (11 files) — Full Dropbox file manager:
- `DropboxHeader`, `DropboxSidebar`, `DropboxToolbar` — chrome
- `DropboxFileList`, `DropboxFileRow`, `DropboxFileCard` — file display
- `DropboxPreviewPanel`, `DropboxImageEditor` — preview/edit
- `DropboxDialogs` — file operation dialogs
- `dropboxConstants.ts`, `useDropboxStarred.ts` — utilities

**`inbox/`** — Gmail-powered deal inbox:
- `GmailSidebar` — navigation
- `InlineReplyBox`, `RecipientAutocomplete` — compose

**`modules/`** (4 files) — Module/feature tracker: cards, detail dialog, pipeline board, requirements

**`sheets/`** (5 files) — Google Sheets integration:
- `SheetEditor`, `SheetEditorHeader` — spreadsheet editing
- `SheetFileBrowser`, `SheetFileCard` — file picker
- `sheetsDataConverter.ts` — data transformation

**`splitview/`** (4 files) — Dual-panel workspace:
- `SplitViewContainer`, `SplitViewPanel` — layout
- `PageSelector` — panel page picker
- `pageRegistry.ts` — central registry mapping URLs to lazy-loaded page components

## Key Patterns

- **ExpandedView + DetailPanel**: List pages have expanded detail routes at `/expanded-view/:id`
- **Inline editing**: `InlineEditableCell` and `InlineEditableFields` for in-place data changes
- **Kanban + Table views**: Most CRM pages support both kanban board and table views
- **Bulk operations**: `PipelineBulkToolbar` + `SelectAllHeader` for multi-select actions
- **Page registry**: `splitview/pageRegistry.ts` maps all admin pages for the split-view feature
