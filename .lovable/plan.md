

## Plan: Add "Create New Filter" Dialog from the + Button

### What changes

When the user clicks the **+** button in the sidebar header, a dialog/popover will open presenting all the available filter criteria fields. The user can configure these fields to define a custom filter. The fields requested are:

- **Text/Select fields**: Activity Type, Status, Priority, Owned By, Followed, Source, Loss Reason, Company, Tags, Name, Description, #UW, Client Working with Other Lenders, Weekly's
- **Date range fields**: Interactions (Select Date Range), Last Contacted (Select Range), Close Date (Select Date Range), Date Added (Select Date Range)
- **Numeric range fields**: Inactive Days, Days in Stage, Value

### Technical details

**File: `src/pages/admin/EvansUnderwriting.tsx`**

1. **New state**: Add `newFilterOpen` boolean state to control the dialog visibility.

2. **Wire the + button**: The existing `<Plus>` button at line ~717-722 gets an `onClick={() => setNewFilterOpen(true)}`.

3. **New component: `CreateFilterDialog`** — Extract into a new file `src/components/admin/CreateFilterDialog.tsx` (keeps EvansUnderwriting under 300 lines growth). This is a `Dialog` component containing:

   - A "Filter Opportunity" heading
   - A scrollable form with all the requested fields organized in a clean list:
     - **Activity Type** — `Select` dropdown
     - **Interactions** — Date range picker (two date inputs)
     - **Last Contacted** — Select range (numeric min/max or preset)
     - **Inactive Days** — Numeric range input
     - **Stage** — `Select` dropdown (from `UNDERWRITING_STATUSES` / `stageConfig`)
     - **Days in Stage** — Numeric range input
     - **Status** — `Select` dropdown
     - **Priority** — `Select` dropdown
     - **Owned By** — `Select` dropdown (populated from `teamMemberMap`)
     - **Followed** — Checkbox/switch
     - **Date Added** — Date range picker
     - **Source** — `Select` dropdown
     - **Close Date** — Date range picker
     - **Loss Reason** — `Select` dropdown
     - **Company** — Text input
     - **Value** — Numeric range (min/max)
     - **Tags** — Text input
     - **Name** — Text input for filter name
     - **Description** — Textarea
     - **#UW** — Text input
     - **Client Working with Other Lenders** — Checkbox/switch
     - **Weekly's** — Checkbox/switch
   - A "Save Filter" and "Cancel" button footer

4. **Filter name field**: At the top, a text input for naming the custom filter so it appears in the sidebar list.

5. **Local state approach (MVP)**: Initially store custom filters in component state (array of custom filter objects). Each custom filter gets appended to the sidebar nav under a "Custom" section. This avoids a database migration for the initial implementation. A future iteration can persist to a `custom_filters` table.

6. **Integration**: Import and render `<CreateFilterDialog>` in `EvansUnderwriting`, passing `open={newFilterOpen}`, `onOpenChange={setNewFilterOpen}`, `teamMemberMap`, `stageConfig`, and an `onSave` callback that adds the filter to the local custom filters list.

### New file

- `src/components/admin/CreateFilterDialog.tsx` — ~250 lines, contains the Dialog with all filter criteria fields using existing shadcn/ui components (`Dialog`, `Select`, `Input`, `Switch`, `Button`, `Label`, `Calendar`/`Popover` for date ranges, `ScrollArea`).

### Files modified

- `src/pages/admin/EvansUnderwriting.tsx` — Add state, wire + button, import and render `CreateFilterDialog`, add custom filters to sidebar nav.

