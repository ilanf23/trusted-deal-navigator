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
- `SortableColumnHeader`, `DraggableColumnsContext` — drag-to-reorder primitives (pair with `useColumnOrder`)
- `PipelineBulkToolbar`, `SelectAllHeader` — bulk operations
- `InlineEditableCell`, `InlineEditableFields` — data display/edit

### Column reorder pattern (drag-to-reorder) — unified

The sales rep admin portal uses a single shared component set for drag-to-reorder. **Always use these primitives**; do not roll your own per-table.

**Primitives** (all under `src/components/admin/` and `src/hooks/`):

| Module | Role |
|---|---|
| `useColumnOrder` (hook) | Per-user-per-table order persistence (localStorage, scoped by `useAuth().user.id`). Returns `orderedKeys`, `reorderableKeys`, `handleDragEnd`. |
| `<DraggableColumnsContext>` | Wraps the `<thead>` `<tr>` row. Sets up dnd-kit `DndContext` + horizontal `SortableContext` + `DragOverlay`. Takes `items`, `onDragEnd`, `renderOverlay`. |
| `<DraggableTh>` | The unified header cell. Wraps `ResizableColumnHeader` (locked) / `SortableColumnHeader` (draggable). Handles th styling, hover bg, drag wiring, visibility. |
| `<SortableColumnHeader>` | Internal — used by `DraggableTh` when `draggable={true}`. Adds the grip handle and drop indicators. |
| `makeColumnDragOverlay(headers, getWidth)` | Factory for `renderOverlay` — returns the floating chip rendered while dragging. |

**The 4-step recipe** (used by all migrated tables):

1. **Module-level definitions** — declare a `ColumnKey` union, a `REORDERABLE_COLUMNS: ColumnKey[]` array (default left-to-right order), and a `COLUMN_HEADERS: Record<ColumnKey, ColumnHeaderDef>` map (icon + label per key). For pipeline tables (Underwriting/Potential/LenderManagement) the shared `pipelineColumns.ts` module already exports these.

2. **Hook in the component**:
   ```ts
   const { orderedKeys, reorderableKeys, handleDragEnd } = useColumnOrder({
     tableId: 'unique-id',
     defaultOrder: REORDERABLE_COLUMNS,
   });
   ```

3. **Replace the header `<ColHeader>` helper** — convert it from a *React component declaration* (e.g. `const ColHeader = (...) => ...`) to a *helper function* (e.g. `const renderColHeader = (...) => ...`), called as `{renderColHeader({...})}`. **This is non-negotiable.** A component declared inside the parent body becomes a new component reference on every render → React unmounts/remounts the th → under `DndContext`'s pointer-tracking re-renders, the column flashes white/purple on hover. Helper functions don't have a component boundary, so no remount. Comments explaining this gotcha are inlined in `People.tsx` and the other migrated files.

4. **Wrap thead + render body in order**:
   ```tsx
   <thead>
     <DraggableColumnsContext
       items={reorderableKeys.filter(k => columnVisibility[k])}
       onDragEnd={handleDragEnd}
       renderOverlay={makeColumnDragOverlay(COLUMN_HEADERS, k => columnWidths[k])}
     >
       <tr>
         {/* leading locked column rendered outside the map */}
         {orderedKeys.map(key => renderColHeader({ reactKey: key, colKey: key, ... }))}
         {/* trailing locked column outside the map */}
       </tr>
     </DraggableColumnsContext>
   </thead>
   <tbody>
     {rows.map(row => (
       <tr key={row.id}>
         {/* leading sticky cell */}
         {orderedKeys.map(key => { switch (key) { case 'foo': return <td>...</td>; ... } })}
         {/* trailing actions cell */}
       </tr>
     ))}
   </tbody>
   ```

   The body cells **must** render via `orderedKeys.map(key => ...)` — keep the same key set as the header. If they don't, drag-reorder appears to do nothing because the cells stay in their hardcoded positions.

**Migrated tables** (full drag-and-drop): `People.tsx`, `Underwriting.tsx`, `Potential.tsx`, `LenderManagement.tsx`, `Companies.tsx`, `LenderPrograms.tsx`, `TaskTableView.tsx`. Underwriting / Potential / LenderManagement share the body row component `PipelineTableRow.tsx`, which accepts `orderedKeys` and renders cells in that order.

**Not yet migrated** (different architecture or scope; follow the same recipe to add):
- `LoanVolumeLog.tsx` — 19 columns; same recipe applies, just substantial body refactor.
- `EmployeePipeline.tsx` — uses a different column-management system (`usePipelineColumns`) with runtime-added columns; needs a custom integration.
- `Projects.tsx` — minimal table (5 cols, no visibility state); can be added with a slightly trimmed recipe.

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
