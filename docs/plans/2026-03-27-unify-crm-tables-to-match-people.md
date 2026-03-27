---

# Unify CRM Tables to Match People Table Styling

## Overview

Make all CRM admin tables visually identical to the People contacts table. The People table uses a purple-themed header (#eee6f6), hardcoded cell borders (#c8bdd6), ResizableColumnHeader (ColHeader), sticky first column with shadow, purple selection highlights, and consistent 13px typography. Six other CRM tables diverge from this standard and need to be aligned. Content stays unchanged.

## Context

- Reference file: `src/pages/admin/People.tsx` (lines ~1301-1625 for table rendering)
- Shared component: `src/components/admin/ResizableColumnHeader.tsx` (ColHeader)
- Files involved:
  - `src/pages/admin/Companies.tsx` — minor: selection color is blue instead of purple
  - `src/pages/admin/Pipeline.tsx` — minor: selection color is blue instead of purple
  - `src/pages/admin/Underwriting.tsx` — minor: selection color is blue instead of purple
  - `src/pages/admin/LenderManagement.tsx` — minor: selection color is blue instead of purple
  - `src/pages/admin/Projects.tsx` — major: uses muted gray header, no borders, no resizable columns, no sticky
  - `src/pages/admin/EmployeeLeads.tsx` — major: uses shadcn Table, completely different styling
  - `src/pages/admin/Leads.tsx` — major: uses shadcn Table, completely different styling
- Not in scope: Tasks (TaskWorkspace component, not a table), Calls (card-based layout), PipelineFeed (activity feed, not a table)

## People Table Reference Spec

These are the exact styling patterns from People.tsx that all tables must match:

- **Table**: Native HTML `<table>` with `tableLayout: 'fixed'`, `borderCollapse: 'collapse'`
- **Header row**: `backgroundColor: '#eee6f6'`
- **Header cells**: ColHeader component with `border: '1px solid #c8bdd6'`, `px-4 py-1.5`, `text-[13px] font-semibold uppercase tracking-wider`, `text-[#3b2778]`
- **All data cells**: `border: '1px solid #c8bdd6'`, `text-[13px]`
- **Row default**: `bg-white dark:bg-card`
- **Row hover**: `hover:bg-[#f8f9fb] dark:hover:bg-muted/30`
- **Selected/detail row**: `bg-[#eee6f6] dark:bg-purple-950/30` with `border-l-[3px] border-l-[#3b2778]`
- **Hover on selected**: `hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40`
- **Bulk selected row**: `bg-[#eee6f6]/60 dark:bg-violet-950/20`
- **Sticky first column**: `sticky left-0 z-[5]` with `boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)'`
- **Sticky bg transitions**: Match row state (white default, purple on selected)
- **Checkbox**: `<Checkbox>` with `h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]`
- **Transition**: `transition-colors duration-100 group` on rows

## Development Approach

- Complete each task fully before moving to the next
- After each task, run `npm run build` to verify no build errors
- No tests to write (project has no test suite per CLAUDE.md)

## Implementation Steps

### Task 1: Fix Companies.tsx selection colors (blue -> purple)

**Files:**
- Modify: `src/pages/admin/Companies.tsx`

- [x] Change selected row bg from `#e8f0fe` / `blue-950` to `#eee6f6` / `purple-950/30`
- [x] Change selected row hover from `#d2e3fc` / `blue-950/40` to `#e0d4f0` / `purple-950/40`
- [x] Update sticky column bg states to match purple scheme instead of blue
- [x] Replace custom div checkbox with Checkbox component using People's styling (`h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]`)
- [x] Add `border-l-[3px] border-l-[#3b2778]` to selected row
- [x] Run `npm run build` to verify

### Task 2: Fix Pipeline.tsx selection colors (blue -> purple)

**Files:**
- Modify: `src/pages/admin/Pipeline.tsx`

- [ ] Change detail-open row bg from `#e8f0fe` / `blue-950/30` to `#eee6f6` / `purple-950/30`
- [ ] Change detail-open hover from `#d2e3fc` / `blue-950/40` to `#e0d4f0` / `purple-950/40`
- [ ] Update sticky column bg states for selected rows to purple scheme
- [ ] Add `border-l-[3px] border-l-[#3b2778]` to selected/detail-open row
- [ ] Run `npm run build` to verify

### Task 3: Fix Underwriting.tsx selection colors (blue -> purple)

**Files:**
- Modify: `src/pages/admin/Underwriting.tsx`

- [ ] Apply same selection color changes as Pipeline (blue -> purple for selected row, hover, sticky bg)
- [ ] Add `border-l-[3px] border-l-[#3b2778]` to selected row
- [ ] Run `npm run build` to verify

### Task 4: Fix LenderManagement.tsx selection colors (blue -> purple)

**Files:**
- Modify: `src/pages/admin/LenderManagement.tsx`

- [ ] Apply same selection color changes as Pipeline (blue -> purple for selected row, hover, sticky bg)
- [ ] Add `border-l-[3px] border-l-[#3b2778]` to selected row
- [ ] Run `npm run build` to verify

### Task 5: Restyle Projects.tsx table to match People

**Files:**
- Modify: `src/pages/admin/Projects.tsx`

- [ ] Replace `bg-muted/60 backdrop-blur-sm` header with `backgroundColor: '#eee6f6'`
- [ ] Add `border: '1px solid #c8bdd6'` to all header and data cells
- [ ] Set table to `tableLayout: 'fixed'`, `borderCollapse: 'collapse'`
- [ ] Replace `bg-muted/30` selected state with `bg-[#eee6f6] dark:bg-purple-950/30` and left border accent
- [ ] Replace `hover:bg-muted/40` with `hover:bg-[#f8f9fb] dark:hover:bg-muted/30`
- [ ] Make first column (Name) sticky with `left-0 z-[5]` and box shadow
- [ ] Update checkbox to People's purple-checked style
- [ ] Match text sizing to 13px and header to uppercase/tracking-wider
- [ ] Add `transition-colors duration-100 group` to rows
- [ ] Run `npm run build` to verify

### Task 6: Restyle EmployeeLeads.tsx table to match People

**Files:**
- Modify: `src/pages/admin/EmployeeLeads.tsx`

- [ ] Replace shadcn `<Table>` / `<TableHeader>` / `<TableRow>` / `<TableHead>` / `<TableCell>` / `<TableBody>` with native HTML `<table>`, `<thead>`, `<tr>`, `<th>`, `<td>`, `<tbody>`
- [ ] Add People's purple header bg (`#eee6f6`), cell borders (`#c8bdd6`), and `borderCollapse: 'collapse'`
- [ ] Apply People's row hover/selection/sticky patterns
- [ ] Make first column (Lead name) sticky with shadow
- [ ] Update checkbox to People's purple-checked style
- [ ] Match all text sizing and spacing to People (13px body, 13px semibold uppercase headers)
- [ ] Replace `bg-accent/5 border-l-2 border-l-foreground` selected state with People's purple styling
- [ ] Run `npm run build` to verify

### Task 7: Restyle Leads.tsx table to match People

**Files:**
- Modify: `src/pages/admin/Leads.tsx`

- [ ] Apply same structural changes as EmployeeLeads: replace shadcn Table with native HTML table
- [ ] Add People's purple header, cell borders, row states, sticky column, checkbox styling
- [ ] Match text sizing and spacing
- [ ] Run `npm run build` to verify

### Task 8: Final verification

- [ ] Run `npm run build` — must pass with no errors
- [ ] Run `npm run lint` — fix any lint issues introduced
