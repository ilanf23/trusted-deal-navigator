

## Fix: Borrower Dropdown Scroll Issue

### Root Cause

The `BorrowerSearchSelect` component has **two competing scroll containers**:
1. `CommandList` (from cmdk) applies its own `max-h-[300px] overflow-y-auto` internally
2. `ScrollArea` wraps content inside CommandList with `h-[200px]`

These conflict with each other -- cmdk's internal height calculations override the CSS, causing the scrollable element to be removed from the DOM when the user tries to scroll (confirmed by session replay).

### Fix (single file: `src/components/evan/tasks/BorrowerSearchSelect.tsx`)

Following the established cmdk scrolling fix pattern already documented in this project:

1. **Remove the `ScrollArea` wrapper** from inside `CommandList` -- it conflicts with cmdk internals
2. **Override `CommandList` max-height** by passing a className like `max-h-[200px]` directly to `CommandList`, letting cmdk handle scrolling natively
3. Move `CommandEmpty` outside the removed `ScrollArea` so it remains a direct child of `CommandList`

This is a ~5-line change in the JSX structure only. No logic or data changes.

