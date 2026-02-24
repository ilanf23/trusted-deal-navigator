

## Fix: Collapsed Sidebar Logo Shows "CX" Instead of "CLX"

### Problem
When the admin sidebar is collapsed, the logo displays "CX" in a generic rounded box (line 403-405 of `AdminSidebar.tsx`). It should show "CLX" styled to match the full logo's font.

### Change

**File: `src/components/admin/AdminSidebar.tsx`** (lines 402-405)

Replace the collapsed logo block:

```tsx
// Current (wrong)
<div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center my-2">
  <span className="text-white font-bold text-sm">CX</span>
</div>

// New (correct)
<span className="text-white font-extrabold text-lg tracking-tight my-2" 
      style={{ fontFamily: "'Inter', sans-serif" }}>
  CLX
</span>
```

This removes the dark rounded box background and displays "CLX" in a bold, clean style matching the full logo aesthetic. No background box, just the text mark.

### Files Changed

| File | Change |
|------|--------|
| `src/components/admin/AdminSidebar.tsx` | Fix collapsed logo from "CX" box to "CLX" text |

