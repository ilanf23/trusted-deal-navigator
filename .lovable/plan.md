

## Fix: Borrower Dropdown Scroll Inside Modal

### Root Cause
The `BorrowerSearchSelect` already renders in a portal (via Radix `PopoverPrimitive.Portal`) outside the modal DOM tree, and has `modal={false}` plus `z-[200]`. However, the Radix Dialog's overlay and focus management intercept `wheel` and `touchmove` events, preventing the dropdown's scrollable container from actually scrolling.

### Fix (single file: `src/components/evan/tasks/BorrowerSearchSelect.tsx`)

Add explicit event propagation stops on the scrollable list container:

1. **Stop wheel event propagation** -- Add `onWheel={(e) => e.stopPropagation()}` to the scrollable `div` so the Dialog overlay cannot consume the scroll event
2. **Stop touchmove propagation** -- Add `onTouchMove={(e) => e.stopPropagation()}` for mobile/trackpad support
3. **Increase max-height** to `280px` per the spec (currently `260px`)
4. **Add pointer-events-auto** to the `PopoverContent` as a safety measure to ensure the portal content receives all pointer interactions

### Technical Details

Changes to the scrollable container div (line 83):
```
Before:
<div className="max-h-[260px] overflow-y-auto overscroll-contain p-1">

After:
<div
  className="max-h-[280px] overflow-y-auto overscroll-contain p-1"
  onWheel={(e) => e.stopPropagation()}
  onTouchMove={(e) => e.stopPropagation()}
>
```

Add `pointer-events-auto` to `PopoverContent` (line 70):
```
Before:
<PopoverContent className="w-[300px] p-0 z-[200]" ...>

After:
<PopoverContent className="w-[300px] p-0 z-[200] pointer-events-auto" ...>
```

No database, backend, or other file changes needed.
