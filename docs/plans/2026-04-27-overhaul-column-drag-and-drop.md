# Overhaul Column Drag-and-Drop Experience

## Overview

The new column-reorder feature on the People CRM table has two problems: (1) columns flash white/purple repeatedly when hovered and during drag operations, and (2) the overall drag-and-drop UX is rough — there is no DragOverlay (the dragged header doesn't follow the cursor), no drop indicator, no keyboard accessibility, and the drag-grip-on-hover pattern is fiddly. This plan rewrites the column drag-and-drop primitives (`DraggableColumnsContext`, `SortableColumnHeader`, and `useColumnOrder`) and updates the only consumer (`People.tsx`) to deliver a polished, modern column reorder experience.

## Context

Files involved:
- `src/components/admin/DraggableColumnsContext.tsx` — current `DndContext` wrapper (no overlay, no sensors beyond pointer with 6px activation)
- `src/components/admin/SortableColumnHeader.tsx` — current grip+label structure (uses `useSortable` with horizontal sorting strategy)
- `src/components/admin/ResizableColumnHeader.tsx` — adjacent resize handle inside same wrapper (must stay click-isolated from drag)
- `src/hooks/useColumnOrder.ts` — per-user localStorage persistence (correct, minor extensions only)
- `src/pages/admin/People.tsx` — sole consumer; the `ColHeader` definition at ~L1004 is the source of the flashing (`hover:bg-[#d8cce8] transition-colors hover:z-20` on the `<th>` combined with dnd-kit transforms on the inner div)

Root cause of flashing:
- Each `<th>` has `hover:bg-[#d8cce8] hover:z-20 transition-colors`
- During drag, dnd-kit applies CSS translate to sibling inner divs, but `<th>` boundaries don't actually move (table cells can't be transformed individually). The cursor crosses cells rapidly, toggling `:hover` on/off → flashing.
- The visible drag also leaves a 50%-opacity ghost in place with no overlay following the cursor, which makes the experience feel broken.

Related patterns:
- shadcn/ui + Tailwind, `cn()` helper from `src/lib/utils`, CRM purple palette (#3b2778, #eee6f6, #d8cce8, #c8bdd6)
- Existing kanban DnD lives in `src/components/admin/pipeline/kanban/` — out of scope; do not touch
- Project rule: column-reorder pattern is documented in `src/components/admin/CLAUDE.md` — must be updated to reflect the new API

Dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (already installed). No new packages.

## Development Approach

- Regular (code first). The repo has no test runner (per CLAUDE.md: "There are no automated tests"); verification is via `npm run lint` + `npm run build` + manual browser checks on `/admin/contacts/people`.
- Complete each task fully before moving on. Manually verify the fix on the People page after each visual task.
- Out of scope: kanban board DnD, file-list DnD, column resizing logic, column visibility toggles, anything outside the new column-reorder feature.

## Implementation Steps

### Task 1: Eliminate the flashing on hover and during drag

Files:
- Modify: `src/pages/admin/People.tsx` (the inline `ColHeader` component near L1004)
- Modify: `src/components/admin/SortableColumnHeader.tsx`

- [ ] Remove `hover:bg-[#d8cce8] transition-colors hover:z-20` from the `<th>` in `ColHeader`. Replace with a stable `bg-[#eee6f6]` only.
- [ ] Move the "active hover" affordance (slight darken + grip reveal) onto the inner `SortableColumnHeader` wrapper instead, applied only when not dragging — so hovering the inner content darkens the cell once via a single non-flashing background layer (an absolutely-positioned inner overlay div, not a `:hover` on the `<th>` itself).
- [ ] In `SortableColumnHeader`, suppress hover affordances on all sibling headers while any drag is active by reading `useDndMonitor` (or `useDndContext().active`) and short-circuiting the hover overlay when `active != null`.
- [ ] Manually verify on `/admin/contacts/people`: hovering a column shows one stable darken (no oscillation), and dragging a column does not cause neighboring columns to flash.

### Task 2: Add a proper DragOverlay so the dragged header follows the cursor

Files:
- Modify: `src/components/admin/DraggableColumnsContext.tsx`
- Modify: `src/components/admin/SortableColumnHeader.tsx`
- Modify: `src/pages/admin/People.tsx`

- [ ] In `DraggableColumnsContext`, track `activeId` via `onDragStart` / `onDragEnd` / `onDragCancel`, and render a `<DragOverlay>` from `@dnd-kit/core` containing a snapshot of the active header (label + icon, styled to match the real header, with a soft purple border/shadow and `cursor-grabbing`).
- [ ] Expose a `renderOverlay?: (activeId: string) => ReactNode` prop so the consumer (`People.tsx`) supplies the overlay content using the same `COLUMN_HEADERS` map. Default to a generic label fallback.
- [ ] In `SortableColumnHeader`, while `isDragging`, render the original cell with reduced opacity + a dashed purple outline in place of the existing flat 50% opacity, so the source slot reads as "this is moving."
- [ ] Wire `People.tsx` to pass a `renderOverlay` that renders the icon + label for the active key.
- [ ] Manually verify: a small floating header chip follows the cursor while dragging; the source cell shows a clear "ghost" placeholder.

### Task 3: Add drop-position indicator + smoother reorder animation

Files:
- Modify: `src/components/admin/SortableColumnHeader.tsx`
- Modify: `src/components/admin/DraggableColumnsContext.tsx`

- [ ] Inside `SortableColumnHeader`, when `isOver` and `!isDragging`, render a 3px-wide vertical purple bar (`bg-[#3b2778]`) absolutely positioned on the leading edge (or trailing edge depending on the active item's index relative to over) of the cell to indicate the drop slot. Use `useSortable`'s `over`/`active` indices to choose the correct edge.
- [ ] Replace the current `horizontalListSortingStrategy` import usage if needed and confirm the `transition` value from `useSortable` is applied so reorder animates the headers' inner content sliding into the new positions on drop.
- [ ] Ensure body cells re-render in the new order after drop (already handled by `visibleOrderedKeys.map(...)` in `People.tsx` — verify only).
- [ ] Manually verify: a clean vertical purple bar shows where the column will be inserted; columns visibly slide into place after release.

### Task 4: Better drag-handle UX, sensors, and accessibility

Files:
- Modify: `src/components/admin/SortableColumnHeader.tsx`
- Modify: `src/components/admin/DraggableColumnsContext.tsx`

- [ ] Replace the always-shrinking grip layout with a grip that's absolutely positioned (or rendered to the left of the icon with `width: 0` until visible) so revealing the grip on hover does not push the label and cause width jitter.
- [ ] Allow drag activation from the entire header label (not only the grip) by attaching `listeners` to the label container, while keeping the resize handle and sort menu insulated via `e.stopPropagation()`. Keep the grip as the visible affordance + keyboard-focus target.
- [ ] Add `KeyboardSensor` from `@dnd-kit/core` with `sortableKeyboardCoordinates` from `@dnd-kit/sortable` so keyboard users can Tab to the grip and reorder with arrow keys + Space.
- [ ] Tune `PointerSensor` activation to `{ distance: 8 }` and add a small `delay` only on touch via a separate `TouchSensor` with `{ delay: 150, tolerance: 5 }` so taps on the sort menu and resize handle still work on tablets.
- [ ] Provide a screen-reader announcement using dnd-kit's `accessibility.announcements` (start / over / end / cancel) using the column label.
- [ ] Manually verify: keyboard reorder works (Tab to grip, Space, arrows, Space to drop); touch on iPad reorders without conflicting with sort/resize; label no longer jitters when grip appears.

### Task 5: Polish the cursor, body-scroll, and edge cases

Files:
- Modify: `src/components/admin/DraggableColumnsContext.tsx`
- Modify: `src/components/admin/SortableColumnHeader.tsx`

- [ ] While a drag is active, set `document.body.style.cursor = 'grabbing'` and `userSelect = 'none'` (and clean up on end/cancel) to prevent the OS cursor flickering between grab/text/default as it crosses cells.
- [ ] Add `modifiers={[restrictToHorizontalAxis]}` (from `@dnd-kit/modifiers`) to constrain the overlay and translate strictly to the horizontal axis. If `@dnd-kit/modifiers` is not installed, write a tiny inline modifier `({ transform }) => ({ ...transform, y: 0 })` to avoid adding a dependency.
- [ ] Cancel any active drag on `Escape` (dnd-kit handles this natively — verify it works and add a keyboard listener fallback only if needed).
- [ ] Confirm locked columns (sticky checkbox/person column at start, trailing actions column at end) cannot be dropped onto by checking that they remain outside `reorderableKeys` and that the drop indicator never appears on them. Test by attempting to drop at the very start/end of the table.

### Task 6: Update CLAUDE.md and verify

Files:
- Modify: `src/components/admin/CLAUDE.md`
- Run: `npm run lint`, `npm run build`

- [ ] Update the "Column reorder pattern" section to document the new `renderOverlay` prop, keyboard support, and the no-flash hover layer pattern.
- [ ] Run `npm run lint` and resolve any new warnings/errors introduced by these changes.
- [ ] Run `npm run build` and confirm a clean production build.
- [ ] Move this plan to `docs/plans/completed/`.

## Post-Completion (manual QA)

These are not agent-checkbox items — they are operator-side verifications to perform in the browser at `/admin/contacts/people` once Tasks 1–6 are done:

- Hover any reorderable column header — single stable darken, no oscillation.
- Press-and-drag a column — overlay chip follows cursor; source cell shows ghost; vertical purple drop bar appears at the target slot.
- Release — column slides into place; persisted across reloads (per-user localStorage).
- Try dropping onto the sticky Person column or the trailing actions column — operation is rejected (no drop indicator on locked cells).
- Tab to a header grip and use Space + arrows + Space to reorder via keyboard.
- Test on a touch device (or Chrome devtools touch emulation) — long-press to drag does not conflict with sort menu taps or resize.
- Confirm the kanban board (`/admin/pipeline`) is unaffected.
