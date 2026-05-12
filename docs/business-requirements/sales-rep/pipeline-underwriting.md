# Pipeline — Underwriting

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/pipeline/underwriting` · detail: `/admin/pipeline/underwriting/expanded-view/:leadId`
**Source file:** `src/pages/admin/Underwriting.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

The mid-funnel board for deals being financially underwritten — collecting docs, building projections, scoring against lender criteria. Sits between *Potential* (qualifying) and *Lender Management* (lender shopping).

## Primary user

Sales rep + underwriting support working a deal in diligence. Secondary: founders reviewing what's stuck in UW.

## Entry points

- Sidebar nav: **Pipeline → Underwriting**
- Promoted from a *Potential* deal via *Send to Underwriting*
- Deep link from Feed or activity notification

## What the user can do here

- See deals in Kanban (by UW stage) or Table mode
- Drag deals across UW stages (e.g. *Docs Outstanding* → *Projections Built* → *Ready for Lenders*)
- Inline-edit deal fields
- Bulk reassign, bulk change stage, bulk mark outcome
- Build/save/share filters
- Open expanded view with full doc checklist, projections, lender notes
- Promote a UW-ready deal to Lender Management

## Key business rules

- Stages come from `pipeline_stages` for the *Underwriting* system pipeline
- A row in `underwriting` references back to the originating `potential.id` (1:1)
- `deal_outcome` and `priority` enums are the same as Potential
- Closing a UW deal as `lost` or `abandoned` does not delete the underlying Potential row — it's preserved for analytics
- Promoting to Lender Management creates a `lender_management` row; the UW row remains visible until explicitly closed

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Deal name | `underwriting` joined to `potential` | |
| UW stage | `underwriting.stage_id` → `pipeline_stages.name` | |
| Doc status | computed from doc checklist subtable | |
| Loan amount | inherited from `potential.loan_amount` | |
| Owner | `underwriting.team_member_id` → `users.name` | |
| Days in stage | computed from `lead_activities` stage-change timestamps | |

## User flows

### 1. Work an active UW deal
1. Open Underwriting → filter to own deals
2. Click a deal → expanded view
3. Update doc checklist, attach files via Dropbox tab
4. Drag to next stage when ready
5. Promote to Lender Management when scored

### 2. Triage stuck deals
1. Sort by *Days in stage* descending
2. Top of list = deals stalled longest
3. Reassign, escalate, or close as `abandoned`

## Edge cases & known gaps

- Doc checklist completion isn't enforced at stage boundaries — can promote with missing docs
- Projections are stored as a separate Fortune Sheet doc; no validation against UW data
- "Days in stage" relies on activity rows being created on every stage change (they are, but historical data may be incomplete)
- Promoting to LM creates a new row but doesn't migrate notes/files (links remain, but feels like duplication)

---

## Technical anchors

### Components used
- `src/components/admin/UnderwritingDetailPanel.tsx`
- `src/components/admin/UnderwritingExpandedView.tsx` (route component)
- Shared pipeline components (KanbanBoard/Column/Card, PipelineTableRow, PipelineBulkToolbar, SavedFiltersSidebar, CreateFilterDialog, PipelineSettingsPopover, ResizableColumnHeader)

### Hooks
- `useSystemPipelineByName('Underwriting')`
- `usePipelineStages`
- `useUnderwritingDeals` (variant of `usePipelineLeads`)
- `useCrmMutations`
- `useColumnOrder`, `useAutoFitColumns`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `underwriting` | ✓ | ✓ |
| `potential` | ✓ | — |
| `pipeline_stages` | ✓ | — |
| `lead_activities` | — | ✓ |
| `users` | ✓ | — |

### Edge functions
- None directly

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see own + team UW deals; founders see all

## Open questions

- [ ] Enforce doc-checklist completeness before stage promotion?
- [ ] Migrate (or link) notes/files automatically when promoting to LM?
- [ ] Lender-score field on UW so LM promotion carries scoring forward?
- [ ] Time-in-stage alerts when a deal exceeds an SLA?
