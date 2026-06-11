# Stabilize Table Row Heights Across the Site

## Objective

Make populated table rows render as one visual line at rest, with a stable compact
height before and after data loads. Long content must truncate or summarize
instead of wrapping a cell and expanding the entire row.

This plan covers record/list tables. Intentionally non-record layouts, such as
email bodies or detail panels, are not part of the row-height contract.

## Diagnosis

### Primary cause: cells permit wrapping

There is no site-wide one-line contract for table body cells:

- `src/components/ui/table.tsx` gives `TableCell` padding and vertical
  alignment, but not `whitespace-nowrap`, `overflow-hidden`, or truncation.
- `src/components/shared/DataTable.tsx` also renders ordinary text cells without
  a no-wrap wrapper.
- `src/index.css` makes `.admin-portal th` nowrap, but `.admin-portal td` can
  wrap freely.
- Custom CRM tables apply fixed column widths, but several body-cell paths do
  not protect those widths with `whitespace-nowrap`.

Once real text, badges, buttons, or dates are rendered in a narrow cell, the
browser wraps them and sets the `<tr>` height from the tallest wrapped cell.

### Why it appears during page loading

The CRM tables compute widths after data becomes available:

- `src/hooks/useAutoFitColumns.ts` initially returns only `minWidths` when the
  data array is empty.
- After the query resolves, it derives widths from visible row text.
- Persisted manual widths from `localStorage` override both minimum and
  auto-fitted widths, even when a saved width is too narrow for current content.

This creates an initial layout change. A populated render can therefore appear
with wrapped/tall rows while widths are narrow or persisted, and some pages
remain tall because wrapping is allowed regardless of auto-fit.

### Explicit multi-line row renderers

Some current implementations intentionally produce two or more lines, so they
cannot satisfy the requested contract through width calculation alone:

- `src/components/admin/pipeline/PipelineTableRow.tsx`: the tags cell uses
  `flex-wrap`, permitting stacked tags.
- `src/components/employee/tasks/TaskTableView.tsx`: Task and Customer cells
  render secondary lines for description and company name.
- `src/pages/admin/RateWatch.tsx`: Borrower and Property cells render secondary
  lines.
- `src/pages/admin/LenderPrograms.tsx`: Looking For uses
  `whitespace-pre-wrap break-words line-clamp-3`, deliberately expanding rows.
- `src/pages/admin/Newsletter.tsx`: campaign cells display campaign name and
  subject on two lines.
- `src/components/employee/dashboard/TopActions.tsx`: Action rows display
  action plus lead metadata on two lines.

### Evidence of partial handling

`src/pages/admin/People.tsx` applies `whitespace-nowrap` to its body
`cellClass`. That targets the symptom correctly for People, but it is
page-local and does not address the other CRM tables, auto-fit transitions, or
deliberate multi-line renderers.

## Row Contract

Define a shared rule for every record-table body row in read mode:

1. A data row has one visual content line, with one consistent vertical padding
   value per table density.
2. Cell containers use `overflow-hidden whitespace-nowrap`.
3. Unbounded text is rendered in a shrinkable wrapper with
   `min-w-0 truncate`, with the full value available by `title`, tooltip, or the
   detail view.
4. Chips, badges, controls, dates, and action groups use `shrink-0` and
   `whitespace-nowrap`.
5. Multiple tags or related values are reduced to a one-line summary, such as
   the first tag plus `+N`, rather than wrapping.
6. Inline editing may open a popover or temporary editing state, but the
   non-editing table row must return to the fixed one-line height.
7. Horizontal scrolling is acceptable for dense tables; vertical growth caused
   by wrapping is not.

Do not globally set every `td` in the product to nowrap. Apply this contract to
record-table components and table pages so settings matrices and other
deliberately structured content can be evaluated independently.

## Affected Surfaces

### Tier 1: CRM fixed-layout and resizable tables

These are most likely to expose the issue because they combine fixed widths,
auto-fit widths, saved resize state, and compact CRM styling:

- `src/components/admin/pipeline/PipelineTableRow.tsx`, consumed by
  `Potential.tsx`, `Underwriting.tsx`, and `LenderManagement.tsx`
- `src/pages/admin/People.tsx`
- `src/pages/admin/Companies.tsx`
- `src/pages/admin/Projects.tsx`
- `src/pages/admin/LoanVolumeLog.tsx`
- `src/pages/admin/LenderPrograms.tsx`
- `src/components/employee/tasks/TaskTableView.tsx`

### Tier 2: shadcn/Table-based record tables

These inherit wrap-capable `TableCell` behavior and need the same contract
through a shared opt-in style or wrapper:

- `src/components/shared/DataTable.tsx`
- `src/pages/admin/Contracts.tsx`, `Invoices.tsx`, `Marketing.tsx`,
  `Tracking.tsx`, `Newsletter.tsx`
- `src/pages/admin/AdamsPage.tsx`, `BradsPage.tsx`, `WendysPage.tsx`,
  `MaurasPage.tsx`, `SuperAdminDashboard.tsx`, `UsersAndRoles.tsx`
- `src/components/admin/modules/RequirementsTable.tsx`
- `src/components/admin/ai-changes/AIChangesTable.tsx`
- `src/components/employee/tasks/CompletedTasksSection.tsx`
- `src/pages/partner/Commissions.tsx`

### Tier 3: verify separately

These table-like screens may need compact rows, but should be accepted or
excluded explicitly because they contain settings controls or public-page
content:

- `src/components/admin/settings/InviteUsersSection.tsx`
- `src/components/admin/settings/NotificationsMatrixSection.tsx`
- `src/components/admin/settings/EmailTemplatesSection.tsx`
- `src/pages/Auth.tsx`

## Implementation Plan

### Phase 1: Establish the reusable single-line primitives

Files:

- Modify `src/components/shared/DataTable.tsx`
- Add a small shared table style module or class set under
  `src/components/shared/` (exact form should follow implementation preference)
- Avoid broad behavior changes to `src/components/ui/table.tsx`

Tasks:

- Add an explicit `singleLine`/compact record-table behavior to `DataTable`,
  defaulting on for its list-table use cases.
- Standardize body-cell classes: `overflow-hidden whitespace-nowrap`; render
  plain string values inside `block min-w-0 truncate`.
- Provide reusable class constants or a `SingleLineCellContent` wrapper for
  custom/native tables and rendered column content.
- Provide a one-line overflow pattern for badges/actions and a standard
  full-value disclosure mechanism (`title` is sufficient for plain text;
  existing detail views remain authoritative for rich content).

Acceptance:

- A long value in any shared `DataTable` row truncates and cannot increase row
  height.

### Phase 2: Fix width initialization and persisted-width behavior

Files:

- Modify `src/hooks/useAutoFitColumns.ts`
- Modify callers only where width-key migrations are needed

Tasks:

- Validate and clamp widths loaded from `localStorage`; saved widths must not be
  less than their configured minimum and should not exceed `maxAutoWidth`
  unless an explicit wider resize limit is introduced.
- Decide whether persisted widths are authoritative or whether a reset/version
  bump is required for existing users with narrow saved columns. For this bug,
  bump the storage keys or migrate invalid values so users do not retain
  wrapping-inducing layouts.
- Keep initial and post-fetch behavior predictable: render using valid minimum
  widths immediately and allow auto-fit growth without row-height change
  because text no longer wraps.
- Add unit coverage for merge priority and persisted-width clamping if a test
  harness is introduced; otherwise extract the calculation into a pure helper
  that can be tested cheaply.

Acceptance:

- Empty/loading render, populated render, refresh with saved widths, and reset
  widths all keep rows single-line and within supported column limits.

### Phase 3: Repair the shared CRM pipeline row once

Files:

- Modify `src/components/admin/pipeline/PipelineTableRow.tsx`
- Verify `src/pages/admin/Potential.tsx`
- Verify `src/pages/admin/Underwriting.tsx`
- Verify `src/pages/admin/LenderManagement.tsx`

Tasks:

- Apply `whitespace-nowrap` to all normal body-cell containers and ensure each
  pill/content child can shrink and truncate.
- Replace tag `flex-wrap` with one-line rendering, for example first visible
  tags constrained in a non-wrapping flex row and a `+N` overflow chip.
- Confirm `InlineEditableCell` and `EditableTextBox` read states do not change
  row height; choose overlay/popover editing for long values rather than
  expanding the table row.
- Retain existing drag, resize, sticky-column, selection, and detail-opening
  behaviors.

Acceptance:

- Potential, Underwriting, and Lender Management receive the fix from one
  component change; long company, stage, owner, and tag values remain one
  line.

### Phase 4: Bring remaining CRM-style tables under the contract

Files:

- Modify `src/pages/admin/People.tsx`
- Modify `src/pages/admin/Companies.tsx`
- Modify `src/pages/admin/Projects.tsx`
- Modify `src/pages/admin/LoanVolumeLog.tsx`
- Modify `src/pages/admin/LenderPrograms.tsx`
- Modify `src/components/employee/tasks/TaskTableView.tsx`

Tasks:

- Keep and generalize People's current no-wrap change; apply equivalent body
  cell handling in Companies, Projects, and Loan Volume Log.
- Set `tableLayout: 'fixed'` for Loan Volume Log if its resizable-column
  behavior is intended to match other CRM tables; otherwise document why its
  browser-auto layout is required.
- For Lender Programs, truncate Looking For in the table and expose full text
  in its existing detail/edit experience. Editing should not create a permanent
  multi-line read row.
- For Tasks, replace the secondary description/customer-company lines with a
  single-line composed display or reveal them in the task detail view/tooltip.
  Apply no-wrap to date, status, and priority cells.

Acceptance:

- All fixed/resizable CRM-style tables have the same compact resting row
  height, including after resize and reload.

### Phase 5: Migrate standard record tables

Files:

- Modify Tier 2 page/components listed above, using `DataTable` where it fits
  without removing table-specific functionality, or applying the same
  single-line classes locally where controls are specialized.

Tasks:

- Add nowrap/truncation to record values, badges, dates, and action groups.
- Preserve responsive hidden-column behavior and horizontal overflow.
- Collapse intentional two-line content:
  - Newsletter: display campaign name on the row and reveal subject via
    tooltip/detail content.
  - Top Actions: display action on the row and move combined lead metadata to
    tooltip/detail navigation.
  - Completed Tasks: truncate task/customer values and make all chips nowrap.
- Keep empty/loading rows exempt from the data-row height contract; their
  deliberate large empty-state cells are not data rows.

Acceptance:

- No standard record table gains height from long populated content at desktop
  or narrow supported viewports.

### Phase 6: Audit special tables and codify the rule

Files:

- Evaluate Tier 3 files individually
- Update `src/components/CLAUDE.md` or the local table documentation

Tasks:

- For settings tables whose labels can reasonably remain one line, opt them in.
- For matrices or public content that truly requires wrapped labels, explicitly
  document the exception rather than inheriting record-table rules by accident.
- Document the one-line row rule for new tables, including how to display long
  secondary content and how to opt out.

Acceptance:

- Future table work has a documented default and any multi-line row is a
  deliberate exception.

## Verification Plan

### Automated checks

- Run `npm run build`.
- Run `npm run lint`, separating existing lint failures from regressions
  introduced during this work.
- If width calculation is extracted into a pure helper, add tests covering:
  empty data, loaded data, narrow persisted widths, overly wide persisted
  widths, and missing/corrupt stored widths.

### Browser regression matrix

For each Tier 1 table and representative Tier 2 tables, validate:

- Fresh visit with empty `localStorage`.
- Reload after manually reducing several column widths.
- Slow network/data load, watching the table before and after rows arrive.
- Very long person/company/title/email/tag/status/notes values.
- Compact and comfortable density modes where present.
- Column reorder, resize, selection, hover, sticky column, inline edit, and
  detail-panel navigation.
- Desktop and narrow viewport behavior; narrow viewports should scroll
  horizontally rather than produce two-line rows.

### Measurable acceptance check

Add a Playwright smoke check for representative routes after authentication
fixtures are available:

- Find ordinary populated `<tbody>` rows, excluding empty/loading and active
  editing states.
- Assert all sampled row heights within the same density/table are equal within
  1 px.
- Reload with seeded narrow persisted widths and repeat the assertion.

## Delivery Order

1. Shared single-line cell behavior and width-state validation.
2. Pipeline shared row, then People/Companies/Projects/Loan Volume Log.
3. Lender Programs and Tasks intentional multi-line redesign decisions.
4. Remaining shadcn/record tables.
5. Special-table audit, documentation, and browser regression checks.

This order fixes the highest-impact shared surfaces first while avoiding broad
CSS changes that could silently alter non-record content.
