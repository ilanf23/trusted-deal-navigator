# Pixel-Perfect Redesign of Feed Page Left Sidebar

## Overview

Redesign the FeedLeftPanel component to match the target design exactly. All changes are CSS/JSX visual changes in a single component file. The filter interaction model changes from multi-select checkboxes to single-select plain text items, but the Set-based interface to the parent is preserved (just always containing 0 or 1 items).

## Context

- Files involved:
  - Modify: `src/components/feed/FeedLeftPanel.tsx` (main file, all visual changes)
- Related patterns: shadcn/ui components, Tailwind utility classes, existing purple/violet accent color
- Dependencies: None beyond what already exists

## Development Approach

- CSS/JSX only changes, no data fetching or business logic changes
- The `onFiltersChange` prop still receives a `Set<string>`, but the component enforces single-select by only ever passing a set with 0 or 1 items
- No tests exist for this component; verification is `npm run build` with zero errors

## Implementation Steps

### Task 1: Redesign welcome section, add divider, add team member buttons

**Files:**
- Modify: `src/components/feed/FeedLeftPanel.tsx`

- [x] Change welcome heading from `text-[15px] font-semibold` to `text-xl font-bold text-foreground leading-tight` (single element, not two separate h2 tags)
- [x] Change description text from `text-xs` to `text-sm text-muted-foreground leading-relaxed`, add `mt-3` spacing
- [x] Remove the stats row entirely (the div showing `activityCounts.total` and `activityCounts.last30Days`)
- [x] Add a horizontal divider (`border-b border-border my-4`) between description and team buttons section
- [x] Add team member buttons row: render `teamMembers` as outlined circles using `w-10 h-10 rounded-full border-2 border-slate-300 bg-transparent text-slate-700 font-medium text-sm flex items-center justify-center hover:bg-slate-100 transition-colors` in a `flex items-center gap-3` container
- [x] Update container padding from `px-5 pt-6 pb-4` to `px-5 py-6`

### Task 2: Redesign search input and filter list

**Files:**
- Modify: `src/components/feed/FeedLeftPanel.tsx`

- [x] Update search input: change to `h-10 rounded-lg border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400`, add search icon (magnifying glass) positioned absolute left-3, input `pl-9`, container `mt-4`
- [x] Update "All" button active state: `px-3 py-2 rounded-lg bg-violet-50 text-violet-600 font-medium text-sm`, inactive: `px-3 py-1.5 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors rounded-lg`
- [x] Remove all checkboxes from filter items - change from `<label>` with `<input type="checkbox">` to simple clickable `<button>` elements
- [x] Remove all count number badges from filter items
- [x] Change filter items to single-select: clicking a filter calls `onFiltersChange(new Set([filter]))`, clicking the active filter or "All" calls `onFiltersChange(new Set())`
- [x] Style filter items: default `px-3 py-1.5 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors rounded-lg`, active same as "All" active style
- [x] Tighten filter list spacing to `space-y-0.5`
- [x] Add `mt-3` between search input and "All" item, `mt-1` between "All" and filter list

### Task 3: Verify build and overall spacing

**Files:**
- Modify: `src/components/feed/FeedLeftPanel.tsx` (final spacing adjustments if needed)

- [x] Ensure overall container uses `px-5 py-6 flex flex-col` with correct section spacing: heading-to-description `mt-3`, description-to-divider `mt-4`, divider-to-team-buttons `mt-4`, team-buttons-to-search `mt-4`, search-to-All `mt-3`, All-to-filter-list `mt-1`, filter items `space-y-0.5`
- [x] Run `npm run build` to confirm zero TypeScript errors
- [x] Run `npm run lint` to check for lint issues
