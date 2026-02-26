

## Plan: Add Sort Leads Popover Next to Table/Kanban Toggle

### What changes

Add a "Sort by" button with a popover dropdown next to the existing Table/Kanban toggle in the header area. The popover will show two selectors — one for the sort field and one for the direction (Ascending/Descending) — matching the reference screenshot's layout.

### Technical details

**File: `src/pages/admin/EvansUnderwriting.tsx`**

1. Add imports for `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover` and `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select`.

2. Replace the current `sortPresetIdx` cycling approach with two independent state variables:
   - `sortField` state (default: `'last_activity_at'`)
   - `sortDir` state (default: `'desc'`)
   
   This gives the user full control over field + direction independently via the popover UI.

3. Insert a sort button + popover immediately after the view mode toggle (line ~611), styled as a small icon button matching the toggle height. The popover content will contain:
   - "Sort by" heading
   - A `Select` for the field (Name, Company, Status, Last Activity, Owner, Updated)
   - A `Select` for direction (Ascending / Descending)

4. The existing `filteredAndSorted` memo already uses `sortField` and `sortDir` — just need to ensure these are wired to the new independent states instead of the preset index.

5. The column header sort arrows will continue to work by updating these same two states.

