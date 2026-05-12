# Pipeline — Projects

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/pipeline/projects` · detail: `/admin/pipeline/projects/expanded-view/:projectId`
**Source file:** `src/pages/admin/Projects.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

The closing workflow board. Once a deal has an accepted term sheet, it moves here to track everything between *signed term sheet* and *funded* — closing checklist, approval gating, scheduling. The destination for late-stage deals; the gateway to revenue recognition.

## Primary user

Sales rep coordinating a closing, plus ops/closer running the checklist. Secondary: founders watching what's about to fund.

## Entry points

- Sidebar nav: **Pipeline → Projects**
- Promoted from a *Lender Management* deal with accepted term sheet
- Deep link from activity notifications

## What the user can do here

- See projects grouped by closing stage (e.g. *Closing Checklist in Process*, *Waiting on Approval*, *Closing Scheduled*, *Closed*)
- Filter by owner, related people, modified date
- Bulk select → reassign, change stage, archive
- Inline-edit project fields
- Open expanded view (`/admin/pipeline/projects/expanded-view/:projectId`) for full checklist, approvals, related people
- Undo last action via the global undo toast

## Key business rules

- Stage values are a fixed set: `open`, `closed`, `on_hold`, `waiting_on_approval`, `closing_checklist_in_process`, `waiting_on_closing_date`, `closing_scheduled`, `ts_received_brad_to_discuss`
- Priority labels include deal context: `urgent_to_close`, `urgent_to_get_approval`, `purchase`, `refinance`
- Each project is linked to people (borrower contacts) via a join table — multiple people per project
- Closing a project does **not** auto-mark the upstream `lender_management` row as `won` — must be done explicitly (intentional, so revenue/commission attribution is deliberate)
- The `ts_received_brad_to_discuss` stage is a founder-review checkpoint specific to the firm's workflow

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Project name | `projects.name` | |
| Owner | `projects.team_member_id` → `users.name` | |
| People | join table → `users` / `people` | Comma list |
| Related | linked `lender_management` / `underwriting` / `potential` | |
| Stage | `projects.stage` | Enum |
| Priority | `projects.priority` | Enum |
| Modified | `projects.updated_at` | |

## User flows

### 1. Run a closing checklist
1. Open project expanded view
2. Tick off checklist items as docs arrive
3. Drag stage to *Closing Scheduled* when date set
4. After funding, mark stage *Closed* and explicitly set upstream LM outcome to `won`

### 2. Reassign a stuck project
1. Filter projects by *Waiting on Approval* sorted by modified asc
2. Multi-select → bulk reassign to a closer
3. Activity log records the change

### 3. Undo an accidental delete
1. Delete a project → undo toast appears (via `UndoContext`)
2. Click *Undo* within window → project restored

## Edge cases & known gaps

- Stage enum is hardcoded in the page — adding a new closing stage requires code + enum migration
- No automatic linking back when upstream LM row is changed
- Bulk delete bypasses some validation; the undo system mitigates but doesn't fully prevent
- Closing date isn't a structured field on `projects` — lives in stage label or notes
- No revenue/commission integration; that lives in Invoices and is manual

---

## Technical anchors

### Components used
- `src/components/admin/ProjectDetailDialog.tsx`
- `src/components/admin/ProjectDetailPanel.tsx`
- `src/components/admin/ProjectExpandedView.tsx` (route component)
- `src/components/admin/ProjectsFilterPanel.tsx`
- `PipelineBulkToolbar`, `ResizableColumnHeader`, `AdminTopBarSearch`

### Hooks / contexts
- TanStack Query directly against `projects`
- `useTeamMember`, `useAssignableUsers`
- `useUndo` from `UndoContext` (delete undo)
- `useAutoFitColumns`, `useAdminTopBar`, `usePageDatabases`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `projects` | ✓ | ✓ |
| `project_people` (or similar join) | ✓ | ✓ |
| `users` | ✓ | — |
| `lender_management` | ✓ | — |

### Edge functions
- None directly

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see own + team projects; founders see all

## Open questions

- [ ] Promote stages from hardcoded enum to a `pipeline_stages`-style config table?
- [ ] Structured `closing_date` field with calendar integration?
- [ ] Auto-mark upstream LM as `won` when project marked *Closed*?
- [ ] Commission auto-calc → Invoice generation handoff?
