# Pipeline — Lender Management

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/pipeline/lender-management` · detail: `/admin/pipeline/lender-management/expanded-view/:leadId`
**Source file:** `src/pages/admin/LenderManagement.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

The lender-shopping board. Once a deal is underwritten and ready, it lives here while the rep pitches it to candidate lenders, collects term sheets, and walks the borrower through selection. Sits between *Underwriting* and the *Projects* (closing) workflow.

## Primary user

Sales rep actively shopping a deal to lenders. Secondary: founders reviewing pipeline depth and term-sheet activity.

## Entry points

- Sidebar nav: **Pipeline → Lender Management**
- Promoted from an *Underwriting* deal
- Deep link from Feed activity (e.g. "term sheet received")

## What the user can do here

- See deals in Kanban (by LM stage — e.g. *Out to Lenders*, *Term Sheets In*, *Borrower Reviewing*) or Table
- Drag deals across LM stages
- Add/remove candidate lenders per deal (from `lender_programs`)
- Track which lenders have been contacted, who replied, and with what terms
- Bulk reassign, bulk stage change
- Build/save filters
- Open expanded view to manage attached lenders, term sheets, and notes
- Promote a deal to *Projects* once a term sheet is accepted (closing workflow)

## Key business rules

- Stages come from `pipeline_stages` for the *Lender Management* system pipeline
- A row in `lender_management` references back to `underwriting.id` (which references `potential.id`)
- Attached lenders are stored in a join table (one row per deal × lender)
- Term sheets are tracked as activity entries with structured fields (rate, term, LTV)
- Selecting/accepting a term sheet does not automatically close the deal as `won` — that's an explicit action
- Promoting to Projects creates a `projects` row representing the closing workflow

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Deal name | `lender_management` joined to `potential` | |
| LM stage | `lender_management.stage_id` → `pipeline_stages.name` | |
| # Lenders attached | count from lender-deal join | |
| # Term sheets | count of term-sheet activities | |
| Owner | `lender_management.team_member_id` → `users.name` | |
| Loan amount | inherited from `potential.loan_amount` | |

## User flows

### 1. Send a deal to candidate lenders
1. Open LM deal expanded view
2. Add 5 candidate lenders from Lender Programs
3. Compose bulk outreach via AI Email Assistant
4. Drag deal stage to *Out to Lenders*

### 2. Manage incoming term sheets
1. Reply or new term sheet arrives → logged as activity with rate/term/LTV
2. Stage auto-suggested as *Term Sheets In* (manual confirm)
3. Borrower reviews → rep moves to *Borrower Reviewing*
4. Accepted → mark `deal_outcome = won` → promote to Projects

## Edge cases & known gaps

- No standardized term-sheet capture form — fields entered free-form
- Lender outreach isn't deduped: same lender can be added twice if added from different places
- Stage suggestions are manual — no rules engine auto-moving based on activity
- Term-sheet comparison view (side-by-side) exists in expanded view but is limited
- Lender response time isn't tracked structurally

---

## Technical anchors

### Components used
- `src/components/admin/LenderManagementExpandedView.tsx`
- `src/components/admin/PipelineDetailPanel.tsx`
- Shared pipeline components (KanbanBoard/Column/Card, PipelineTableRow, PipelineBulkToolbar, SavedFiltersSidebar, CreateFilterDialog, PipelineSettingsPopover, ResizableColumnHeader)
- `AddOpportunityDialog`

### Hooks
- `useSystemPipelineByName('Lender Management')`
- `usePipelineStages`
- `useLenderManagementDeals` (variant of `usePipelineLeads`)
- `useCrmMutations`
- `useAssignableUsers`, `useTeamMember`
- `useColumnOrder`, `useAutoFitColumns`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `lender_management` | ✓ | ✓ |
| `underwriting` | ✓ | — |
| `potential` | ✓ | — |
| `lender_programs` | ✓ | — |
| `lender_deal_assignments` (or similar join) | ✓ | ✓ |
| `lead_activities` | ✓ | ✓ (term sheets) |
| `pipeline_stages` | ✓ | — |

### Edge functions
- None directly

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see own + team LM deals; founders see all

## Open questions

- [ ] Structured term-sheet capture (rate / term / LTV / fees) as first-class fields?
- [ ] Lender-response SLA tracking with alerts?
- [ ] Rules engine to auto-advance stage on certain activities?
- [ ] Side-by-side term-sheet comparison UX upgrade?
