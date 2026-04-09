# Make All Expanded View Fields Editable

## Overview

Replace static/read-only field renders (Phone, Email, LinkedIn) with inline-editable components across all expanded views and detail panels. Currently, several contact fields display as plain text or links when they have values, but only show editable inputs when empty. This fix makes every field consistently editable regardless of whether it already has a value.

## Context

- Files involved:
  - `src/components/admin/PipelineExpandedView.tsx` (Phone, Email static when populated)
  - `src/components/admin/PeopleExpandedView.tsx` (Phone, Email, LinkedIn static when populated)
  - `src/components/admin/LenderDetailPanel.tsx` (Phone, Email static when populated)
  - `src/components/admin/PeopleDetailPanel.tsx` (Owner displayed as plain text, Email Domain non-editable)
- Related patterns: `CrmEditableField` in PipelineExpandedView, `EditableField` / `EditableContactRow` in PeopleExpandedView, `EditableField` in LenderDetailPanel
- The codebase already has robust inline-editable components; the issue is that some fields conditionally bypass them when data exists

## Development Approach

- No new components needed; reuse existing `CrmEditableField`, `EditableField`, and `EditableContactRow` patterns
- Each task replaces static JSX with the appropriate editable component while preserving copy/link actions
- No tests (project has no automated test suite)

## Implementation Steps

### Task 1: PipelineExpandedView - Make Email and Phone editable

**Files:**
- Modify: `src/components/admin/PipelineExpandedView.tsx`

- [x] Replace the static Email block (lines ~1495-1510) with `CrmEditableField` using `field="email"`, keeping the copy button via the `copyable` prop
- [x] Replace the static Phone block (lines ~1512-1525) with `CrmEditableField` using `field="phone"`, removing the conditional that only shows CrmEditableField when empty
- [x] Verify both fields render as editable whether populated or empty

### Task 2: PeopleExpandedView - Make Email, Phone, and LinkedIn editable

**Files:**
- Modify: `src/components/admin/PeopleExpandedView.tsx`

- [ ] Replace the static Email block (lines ~2080-2105) with `EditableField` or `EditableContactRow` using `field="email"` and `personId`, removing the conditional guard that only renders when email exists
- [ ] Replace the static Phone block (lines ~2107-2125) with `EditableField` using `field="phone"` and `personId`, removing the conditional guard
- [ ] Replace the static LinkedIn block (lines ~2127-2145) with `EditableField` using `field="linkedin"` and `personId`, removing the conditional guard
- [ ] Verify all three fields render as editable whether populated or empty

### Task 3: LenderDetailPanel - Make Email and Phone editable

**Files:**
- Modify: `src/components/admin/LenderDetailPanel.tsx`

- [ ] Replace the static Email row (lines ~255-274) with `EditableField` using `field="email"`, `lenderId`, and the existing icon/label pattern
- [ ] Replace the static Phone row (lines ~275-294) with `EditableField` using `field="phone"`, `lenderId`, and the existing icon/label pattern
- [ ] Verify both fields render as editable whether populated or empty

### Task 4: PeopleDetailPanel - Make Owner editable

**Files:**
- Modify: `src/components/admin/PeopleDetailPanel.tsx`

- [ ] Replace the static Owner display (lines ~1736-1749) with an `EditableSelectField` or owner dropdown select, matching the pattern used in PipelineDetailPanel for owner assignment
- [ ] Verify the owner field is editable as a dropdown with team member options

### Task 5: Verify all expanded views

- [ ] Run `npm run build` to confirm no TypeScript or build errors
- [ ] Run `npm run lint` to confirm no linting issues
