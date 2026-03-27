# Fix Expanded View Right Column Layout and Spacing

## Overview

Fix the right column in all expanded views so content is never cut off on any screen size, and fix the spacing between "Total Won" and "Win Rate" stats. The right column needs consistent responsive widths, proper scroll handling, and better spacing for financial stats.

## Context

- Files involved:
  - `src/components/admin/PipelineExpandedView.tsx` (line 2007 - right column)
  - `src/components/admin/CompanyExpandedView.tsx` (line 1153 - right column)
  - `src/components/admin/LenderManagementExpandedView.tsx` (line 1660 - right column)
  - `src/components/admin/PeopleExpandedView.tsx` (line 2781 - right column, lines 2784-2805 - Total Won/Win Rate)
  - `src/components/admin/ProjectExpandedView.tsx` (line 897 - right column, lines 956-980 - Total Won/Win Rate)
  - `src/components/admin/UnderwritingExpandedView.tsx` (line 2235 - right column, already has good responsive classes)
- Related patterns: UnderwritingExpandedView and PeopleExpandedView already use responsive `w-full md:w-[280px]` pattern as the best reference
- The `data-full-bleed` attribute removes AdminLayout padding/max-width constraints via CSS in `src/index.css`

## Development Approach

- Complete each task fully before moving to the next
- Verify visual correctness at multiple viewport widths after each change
- Use UnderwritingExpandedView as the reference pattern for responsive right columns

## Implementation Steps

### Task 1: Fix PipelineExpandedView right column

**Files:**
- Modify: `src/components/admin/PipelineExpandedView.tsx`

- [x] Change right column (line 2007) from `w-[220px] xl:w-[260px] shrink-0 min-w-0` to responsive widths: `w-full md:w-[260px] lg:w-[310px] xl:w-[340px] md:shrink-0 md:min-w-[220px] min-w-0` and add responsive border classes `border-t md:border-t-0 md:border-l` (replacing `border-l`)
- [x] Change the flex row container (line 1261) from `flex flex-1 min-h-0 overflow-hidden` to `flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden` so the right column stacks below on mobile
- [x] Run lint: `npm run lint`

### Task 2: Fix CompanyExpandedView right column

**Files:**
- Modify: `src/components/admin/CompanyExpandedView.tsx`

- [x] Change right column (line 1153) from `w-[260px] shrink-0 min-w-0 border-l` to responsive widths: `w-full md:w-[260px] lg:w-[310px] xl:w-[340px] md:shrink-0 md:min-w-[220px] min-w-0 border-t md:border-t-0 md:border-l`
- [x] Change the flex row container (line 775) to include `flex-col md:flex-row` if not already present
- [x] Run lint: `npm run lint`

### Task 3: Fix LenderManagementExpandedView right column

**Files:**
- Modify: `src/components/admin/LenderManagementExpandedView.tsx`

- [x] Change right column (line 1660) from `w-[220px] xl:w-[260px] shrink-0 min-w-0 border-l` to responsive widths: `w-full md:w-[260px] lg:w-[310px] xl:w-[340px] md:shrink-0 md:min-w-[220px] min-w-0 border-t md:border-t-0 md:border-l`
- [x] Change the flex row container (line 1014) to include `flex-col md:flex-row` if not already present
- [x] Run lint: `npm run lint`

### Task 4: Fix PeopleExpandedView Total Won / Win Rate spacing

**Files:**
- Modify: `src/components/admin/PeopleExpandedView.tsx`

- [x] Change the financial stats container (line 2784) padding from `px-3 md:px-3.5 xl:px-5 py-5` to `px-4 md:px-5 xl:px-6 py-5` for more breathing room
- [x] Change the flex row for Total Won / Win Rate (line 2785) from `flex items-start gap-6` to `flex items-start justify-between` so they spread across the full width instead of being crammed together with a fixed gap
- [x] Run lint: `npm run lint`

### Task 5: Fix ProjectExpandedView Total Won / Win Rate spacing

**Files:**
- Modify: `src/components/admin/ProjectExpandedView.tsx`

- [x] Change the right column inner container (line 899) padding from `py-4 px-1 overflow-hidden` to `py-4 px-3 overflow-hidden` for consistent padding in the Related sections
- [x] Verify the financial summary section (line 957) already uses `px-4 py-4` and `flex items-center justify-between` - this is already well-spaced; ensure it stays consistent
- [x] Run lint: `npm run lint`

### Task 6: Verify build passes

- [ ] Run `npm run build` to confirm no build errors
- [ ] Run `npm run lint` for final lint check
