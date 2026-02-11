

# Fix: Persist UI State Across Evan Page Navigation

## Problem
When Evan navigates away from a page (e.g., clicks "Leads" in the sidebar while creating a task) and then returns, all local component state is lost -- open dialogs close, form inputs clear, filters reset. This happens because React unmounts the page component on route change, destroying all `useState` values.

## Solution
Create an `EvanUIStateContext` inside the existing `EvanPortalWrapper` (which already persists call and draft state across routes). This context will store critical UI state for each page so it survives navigation.

## What Gets Preserved

**Tasks page:**
- View mode (table/kanban/timeline)
- Active filters (source, status, priority, search)
- Open task detail dialog (selected task ID)
- New task dialog open state and any in-progress form data

**Dashboard page:**
- Time period selections
- Calculator inputs

**Pipeline page:**
- Collapsed/expanded stage sections
- Selected lead detail dialog

**Gmail page:**
- Selected thread/folder state

## Technical Approach

### 1. Create `src/contexts/EvanUIStateContext.tsx`
A context that holds a simple state map keyed by page name. Each page stores/retrieves its own slice of state.

```
EvanUIState {
  tasks: {
    viewMode, searchTerm, sourceFilter, statusFilter,
    priorityFilter, selectedTaskId, isNewTaskDialogOpen
  },
  dashboard: { timePeriod, chartPeriod },
  pipeline: { collapsedSections, selectedLeadId },
  ...
}
```

The context provides `getPageState(page)` and `setPageState(page, state)` helpers.

### 2. Update `src/components/evan/EvanPortalWrapper.tsx`
Wrap `<Outlet />` with the new `EvanUIStateProvider` alongside the existing `CallProvider` and `DraftProvider`.

### 3. Update `src/components/evan/tasks/TaskWorkspace.tsx`
Replace the ~10 `useState` calls for filters/view/dialogs with values from the context. On state change, write back to context so it persists.

Key states to persist:
- `viewMode`, `searchTerm`, `sourceFilter`, `statusFilter`, `priorityFilter`
- `selectedTask` (stored as task ID, resolved from cached query data on return)
- `isNewTaskDialogOpen`

### 4. Update `src/pages/admin/EvansPage.tsx`
Persist `timePeriod` and `chartPeriod` selections via the context.

### 5. Update `src/pages/admin/EvansPipeline.tsx`
Persist collapsed stage sections and selected lead dialog state.

## Files Changed
| File | Change |
|------|--------|
| `src/contexts/EvanUIStateContext.tsx` | **New** -- context for persistent UI state |
| `src/components/evan/EvanPortalWrapper.tsx` | Add `EvanUIStateProvider` wrapper |
| `src/components/evan/tasks/TaskWorkspace.tsx` | Read/write filter and dialog state from context |
| `src/pages/admin/EvansPage.tsx` | Persist time period selections |
| `src/pages/admin/EvansPipeline.tsx` | Persist collapsed sections |

## Not Changed
- Data fetching remains via React Query (already cached with 2-min staleTime)
- Route structure unchanged
- No database changes needed

