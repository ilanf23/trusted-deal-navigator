

## Make "+ New" Button Functional with Filter Creation UI

### Problem
The "+ New" button next to "Saved Filters" is non-functional -- clicking it does nothing. It needs to open a UI for creating and saving a new filter.

### Changes

**File: `src/pages/admin/UnderwritingPipeline.tsx`**

#### 1. Add state for new-filter creation
Add new state variables:
- `showNewFilterForm: boolean` -- toggles an inline form below the header
- `newFilterName: string` -- the name input value
- `savedFilters: string[]` -- initialized from `SAVED_FILTERS` constant, will hold user-created filters too
- `activeFilter: string` -- tracks which filter is currently selected (defaults to "All Opportunities")

#### 2. Wire up the "+ New" button
On click, set `showNewFilterForm = true`, which reveals a compact inline form directly below the "Saved Filters" header (above the search box).

#### 3. Create the inline new-filter form
A small inline card/row that appears when `showNewFilterForm` is true:
- A text input with placeholder "Filter name..." auto-focused
- A "Save" button (small, purple, ghost style) and an "X" cancel button
- On Save: appends the new name to `savedFilters`, resets form, shows `toast.success`
- On Cancel or Escape key: hides the form

```text
Layout when form is open:

  Saved Filters          + New  ◀
  ┌──────────────────────────────┐
  │ [Filter name...______] Save X│
  └──────────────────────────────┘
  [🔍 Search Filters           ]
  All Opportunities         1,076
  ▾ PUBLIC
    My Open Opportunities
    ...
```

#### 4. Make FilterItem clickable to set active filter
When a filter item is clicked, set `activeFilter` to that filter's name. The "All Opportunities" row and FilterItem rows will highlight based on matching `activeFilter`.

#### 5. Add delete option to FilterItem for user-created filters
The existing `MoreVertical` icon on hover will open a small dropdown with "Delete" for user-created filters (not the default ones). Deleting removes from `savedFilters` and shows `toast.success`.

#### 6. Visual polish
- The inline form uses the same `#E0DFF0` border, `8px` border-radius as the search box
- Save button matches existing purple ghost style (`#7B5EA7` text, `#F3F0FA` hover)
- Focus ring on input uses `#C4B5E0`

### Technical Notes
- Filters are stored in component state only (no DB persistence) -- consistent with the current SAVED_FILTERS approach
- The `toast` import from `sonner` is already available in the project
- No new files needed; all changes within `UnderwritingPipeline.tsx`
- Component stays well under 300 lines of new code added

