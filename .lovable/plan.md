

## Redesign: Saved Filters Sidebar Action Buttons

### Problem
The two rounded-rectangle buttons next to "Saved Filters" (lines 1021-1046) look like empty boxes and are not intuitive. The collapsed-state expand button (lines 1097-1108) is also a vague circle. Users cannot tell what these controls do at a glance.

### Solution
Replace the two boxes with clearly labeled icon-text links, and replace the collapsed expand button with a recognizable sidebar toggle.

### Changes

**File: `src/pages/admin/UnderwritingPipeline.tsx`**

#### 1. Replace the two box buttons (lines 1020-1046) with icon-text actions
Remove the two `28x28` bordered boxes. Replace with:
- A `Plus` icon-text link reading "+ New" styled as a small text button (no border/box)
- A `PanelLeftClose` icon (from lucide-react) for collapsing, also borderless

Both will use a simple ghost-style: transparent background, hover turns `#F3F0FA`, icon + text inline, no box borders.

```text
Before:  Saved Filters  [□] [□]
After:   Saved Filters  + New  ◀
```

#### 2. Replace the collapsed expand button (lines 1097-1108)
Replace the `28x28` circle with a `PanelLeftOpen` icon button (from lucide-react) — a universally recognized sidebar-expand icon. Slightly larger at `32x32`, with a subtle hover background.

#### 3. Import updates
Add `PanelLeftClose` and `PanelLeftOpen` from `lucide-react`. Remove `ChevronLeft` and `ChevronRight` if no longer used elsewhere in this file.

### Visual Result
- "Saved Filters" header will have a clean `+ New` text-link and a recognizable panel-collapse icon
- No more mysterious empty rectangles
- Collapsed state shows a clear panel-open icon instead of a vague circle
- All controls have descriptive tooltips and hover feedback

