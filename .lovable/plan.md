
## Row-Based Feature Toggle for Module Cards

### Current Behavior
A single `showFeatures` boolean in `ModuleTracker` controls ALL cards simultaneously. Clicking "Show features" on any card expands every module.

### Goal
Only cards in the **same visual row** should expand together when one is clicked.

### Solution

The grid is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. The key insight is: instead of one global toggle, track a **Set of open row indices** (`openRows: Set<number>`). Each card receives its row index based on its position in the filtered array and the current column count.

Since CSS grid column count changes with breakpoints, the cleanest approach that avoids complex ResizeObserver logic is to:

1. Replace `showFeatures: boolean` with `showFeatures: boolean` per-row by computing `rowIndex = Math.floor(cardIndex / colCount)`.
2. Track a `Set<number>` of open row indices in `ModuleTracker`.
3. Pass `showFeatures={openRows.has(rowIndex)}` and `onToggleFeatures={() => toggleRow(rowIndex)}` to each card.
4. For column count, use a `useRef` on the grid container and a `ResizeObserver` to detect the actual rendered column count dynamically (avoids hardcoding breakpoints).

### Technical Implementation

**`src/pages/admin/ModuleTracker.tsx`**
- Remove `const [showFeatures, setShowFeatures] = useState(false)`.
- Add `const [openRows, setOpenRows] = useState<Set<number>>(new Set())`.
- Add `const [colCount, setColCount] = useState(3)` with a `useRef` on the grid `<div>`.
- Add a `useEffect` with `ResizeObserver` on the grid ref to compute actual columns:
  ```ts
  const cols = Math.round(gridEl.offsetWidth / (gridEl.firstElementChild?.offsetWidth ?? 1));
  setColCount(Math.max(1, cols));
  ```
- Add `toggleRow(rowIdx: number)` — toggles presence in `openRows`.
- In the map, compute `rowIndex = Math.floor(index / colCount)` and pass as props.
- Reset `openRows` when search changes (so hidden cards don't stay "open").

**`src/components/admin/modules/ModuleCard.tsx`**
- No interface changes needed — `showFeatures` and `onToggleFeatures` props already exist.

### Edge Cases
- If filtered results change (search), reset `openRows` to avoid stale row associations.
- The ResizeObserver approach handles mobile (1 col), tablet (2 col), and desktop (3 col) correctly without hardcoded breakpoints.
