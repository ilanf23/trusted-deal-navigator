# Pipeline — Potential

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/pipeline/potential` · detail: `/admin/pipeline/potential/expanded-view/:leadId`
**Source file:** `src/pages/admin/Potential.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

The top-of-funnel deal board. Every new opportunity lands here and moves through qualification stages until it either advances to Underwriting or is marked lost/abandoned. This is where reps spend most of their time during outreach blocks.

## Primary user

Sales rep working new opportunities. Secondary: founders triaging weekly inflow, ops cleaning up data.

## Entry points

- Sidebar nav: **Pipeline → Potential**
- "Add Opportunity" buttons across the app (Calls, Rate Watch, Feed)
- Public questionnaire submissions auto-create rows here
- Deep link via `?filterId=…` from saved-filter shares

## What the user can do here

- View deals in either Kanban (by stage) or Table mode
- Drag a deal card across stages (writes back to `potential.stage_id`)
- Inline-edit any column (lead name, contact, dollar amount, status, owner)
- Add a new opportunity via dialog
- Bulk-select deals → reassign owner, change stage, mark outcome, delete
- Build, save, and share filters (public/private)
- Reorder/resize columns; persist per user
- Open the expanded view for full detail editing + activity timeline
- Export current view to Excel

## Key business rules

- Pipeline stages come from `pipeline_stages` keyed by `pipeline_id` — system pipeline name is *Potential*
- `deal_outcome` (`open` / `won` / `lost` / `abandoned`) tracks win/loss independently from stage; closing a deal does **not** auto-set outcome
- `priority` (`low` / `medium` / `high`) is independent of stage
- Owner = `team_member_id` (FK to `users`); reassignment writes a `lead_activities` row
- Drag-to-stage writes immediately; no batch save
- A deal moved into the final "qualified" stage doesn't auto-create the Underwriting row — that's a separate manual promotion (intentional, prevents duplicates)

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Lead name | `potential.name` | |
| Company | `potential.company_name` | |
| Stage | `potential.stage_id` → `pipeline_stages.name` | Kanban column |
| Outcome | `potential.deal_outcome` | Badge color |
| Priority | `potential.priority` | Badge |
| Loan amount | `potential.loan_amount` | |
| Owner | `potential.team_member_id` → `users.name` | Avatar |
| Last activity | derived from `lead_activities` | "X days ago" |

## User flows

### 1. Move a deal through a stage
1. Rep drags card from *New* → *Qualifying*
2. `usePipelineMutations.moveStage()` writes new `stage_id` + appends `lead_activities` row
3. Card animates to the new column

### 2. Bulk reassign 10 deals to a new rep
1. Multi-select rows via checkbox
2. `PipelineBulkToolbar` appears → choose *Reassign owner*
3. Pick rep → confirm → batched update + activity log entries

### 3. Promote a deal to Underwriting
1. Open expanded view for a qualified deal
2. Click *Send to Underwriting* → creates `underwriting` row referencing `potential.id`
3. Original `potential` row marked as advanced; appears in both pipelines

## Edge cases & known gaps

- Drag-and-drop on touch devices is finicky
- No undo for stage changes (other CRMs have toast undo)
- Search is client-side over the loaded set — doesn't catch deals not yet fetched
- Export is client-side XLSX; large pipelines (500+ rows) slow the browser
- Lost-reason isn't a structured field; lives in notes

---

## Technical anchors

### Components used
- `src/components/admin/pipeline/kanban/*` (KanbanBoard, KanbanColumn, KanbanCardShell, useKanbanDrag)
- `src/components/admin/pipeline/PipelineTableRow.tsx`
- `src/components/admin/PipelineDetailPanel.tsx`
- `src/components/admin/PipelineBulkToolbar.tsx`
- `src/components/admin/AddOpportunityDialog.tsx`
- `SavedFiltersSidebar`, `CreateFilterDialog`, `PipelineSettingsPopover`
- `ResizableColumnHeader`, `DraggableTh`, `DraggableColumnsContext`, `InlineEditableCell`

### Hooks
- `useSystemPipelineByName('Potential')` — resolves pipeline id
- `usePipelineStages` — stage list
- `usePipelineDeals` — flattened lead rows
- `useCrmMutations` — move stage, edit field, bulk ops
- `useColumnOrder`, `useAutoFitColumns`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `potential` | ✓ | ✓ |
| `pipeline_stages` | ✓ | — |
| `lead_activities` | — | ✓ |
| `users` | ✓ | — |
| `pipeline_saved_filters` (or similar) | ✓ | ✓ |

### Edge functions
- None — direct Supabase

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see own + team deals; founders see all

## Open questions

- [ ] Undo toast for stage changes?
- [ ] Auto-create Underwriting row on final-stage drag?
- [ ] Structured lost-reason field for win/loss analysis?
- [ ] Server-side search across the whole pipeline (not just loaded page)?
