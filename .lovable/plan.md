

## Plan: Fix Expanded View Overlapping Sidebar

### Problem
The expanded view uses negative margins (`-m-3` to `-m-10`) to break out of the `AdminLayout` content padding, but this causes it to slide under the left sidebar. The name also gets truncated because the header is too cramped.

### Solution
Use the existing **`data-full-bleed`** pattern (already used by PipelineFeed) instead of hacky negative margins. This is the established pattern in this codebase for pages that need to fill the entire content area.

### Changes

**`src/components/admin/UnderwritingExpandedView.tsx`**

1. **Replace negative margins with `data-full-bleed`**: Change the root `<div>` from `-m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10` to use the `data-full-bleed` attribute. This lets the CSS rules in `index.css` properly remove padding from the AdminLayout wrapper without overlapping the sidebar.

2. **Adjust height**: Use `h-[calc(100vh-3.5rem)]` matching the PipelineFeed pattern instead of inline style.

3. **Increase left details column width**: Widen from `w-[280px]` to `w-[320px]` so field labels and values have more breathing room.

4. **Header name**: Change `text-base` to `text-lg` and ensure `min-w-0 flex-1` stays so the name doesn't get cut off prematurely.

### Files
- **Modified**: `src/components/admin/UnderwritingExpandedView.tsx`

