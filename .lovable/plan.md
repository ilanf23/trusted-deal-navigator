

## Fix Pipeline Dropdown Alignment in Admin Sidebar

### Problem

The Pipeline dropdown item in the employee sidebar has slight visual misalignment compared to regular (non-dropdown) sidebar items. The icon, text, and chevron arrow are not on the same visual level as other items like "Lender Programs."

### Changes

**File: `src/components/admin/AdminSidebar.tsx`** (lines 403-418)

Update the `CollapsibleTrigger` and its inner `div` to match the exact styling of regular sidebar items:

1. Change `rounded-md` to `rounded-lg` on the inner div (to match regular items at line 469)
2. Change the always-applied `font-semibold` on the text span to conditionally apply it (matching the regular item pattern: `font-semibold` when active, `font-medium` otherwise)
3. Ensure the `CollapsibleTrigger` itself does not add extra spacing by keeping `className="w-full"` and no additional padding

These are small CSS class adjustments -- no structural or logic changes needed.

### Before vs After

| Property | Dropdown (current) | Regular item | Dropdown (fixed) |
|----------|-------------------|--------------|-------------------|
| Border radius | `rounded-md` | `rounded-lg` | `rounded-lg` |
| Font weight | Always `font-semibold` | Conditional | Conditional |
| Padding | `py-2 px-3` | `py-2 px-3` | Same (no change) |
| Gap | `gap-2.5` | `gap-2.5` | Same (no change) |

