

## Fix Feed Page Being Cut Off

### Root Cause

The Feed page is nested inside AdminLayout's content area which applies:
1. Responsive padding (`p-3` up to `xl:p-10`)
2. A `max-w-[1800px] mx-auto` inner wrapper
3. `overflow-x-hidden` on the padding container -- this clips the negative horizontal margins

The current negative margin approach gets clipped by `overflow-x-hidden`, causing the left, right, and top edges to be cut off.

### Solution

Instead of fighting the parent layout with negative margins, use a two-part approach:

1. **On the outer padding wrapper**: Apply a special CSS utility that removes padding and max-width constraints when the Feed page is active. Since we cannot conditionally change AdminLayout from inside a child, we will instead use a **CSS approach with `calc()` and `position: relative`** to break out of the container.

2. **Specifically**: Change the PipelineFeed container to use:
   - `w-[calc(100%+var(--px)*2)]` with a negative left margin to break out of padding
   - Remove the `max-w-none` since the real issue is the parent's `max-w-[1800px]`
   - Use inline styles to dynamically calculate breakout widths matching each breakpoint's padding

**Simpler alternative (recommended)**: Modify AdminLayout to accept an optional `fullBleed` prop or use a CSS class on the content wrapper that children can override. However, since AdminLayout is shared and we don't want to change its API, the cleanest fix is:

**Use a style override on the PipelineFeed wrapper:**
- Apply `margin: -12px` (matching `p-3`) through responsive breakpoints via inline style
- Set `width: calc(100% + 24px)` (double the padding) at each breakpoint
- Set `height: calc(100% + 24px)` to also break out vertically
- Override max-width on the parent using a ref or CSS selector

Actually, the most reliable approach: **Add a `[data-full-bleed]` attribute** to PipelineFeed's container and use a global CSS rule to remove the parent constraints.

### Implementation (File Changes)

**File: `src/index.css`**
Add a global CSS rule that targets the AdminLayout content wrappers when a `[data-full-bleed]` child is present:

```css
/* Full-bleed pages: remove padding and max-width from AdminLayout wrappers */
.admin-portal main > div:has(> [data-full-bleed]) {
  padding: 0 !important;
  overflow: visible !important;
}
.admin-portal main > div > div:has(> [data-full-bleed]) {
  max-width: none !important;
}
```

**File: `src/pages/admin/PipelineFeed.tsx`**
- Add `data-full-bleed` attribute to the outer container
- Remove all negative margin hacks (`-m-3`, `-m-4`, etc.)
- Use simple `h-[calc(100vh-3.5rem-1px)]` for full height
- The container will now naturally fill the space without being clipped

### Technical Details

| Aspect | Current (Broken) | Fixed |
|--------|------------------|-------|
| Horizontal fit | Negative margins clipped by `overflow-x-hidden` | CSS `:has()` removes parent padding |
| Max-width | `max-w-none` on child (ineffective) | Parent `max-w-[1800px]` overridden via CSS |
| Vertical fit | `h-[calc(100vh-3.5rem-1px)]` | Same, no change needed |
| Approach | Fighting parent layout | Cooperating with parent layout via CSS cascade |

