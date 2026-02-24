

## Fix: Settings Panel Toggle Cutoff + UI/UX Polish

### Problem
1. The Columns sub-panel inside the Settings panel has tight right padding (`0 20px 0 4px`), causing toggle switches to be clipped or feel cramped at the right edge.
2. The overall Settings panel UI can be polished for better spacing, visual hierarchy, and interaction feedback.

### Changes

**File: `src/pages/admin/UnderwritingPipeline.tsx`**

#### 1. Fix toggle cutoff in Columns sub-panel (line 838)
Change the column row padding from `'0 20px 0 4px'` to `'0 24px 0 12px'` — more breathing room on both sides so the drag handle and toggle switch are fully visible.

#### 2. Increase left padding on drag handle area (line 841-843)
Add `paddingLeft: '8px'` to ensure the grip icon doesn't sit flush against the panel edge.

#### 3. Polish the Columns sub-panel header (line 814)
Increase header padding from `'20px 20px 16px'` to `'20px 24px 16px'` for consistent horizontal padding.

#### 4. Polish the search input area (line 825)
Update padding from `'12px 20px'` to `'12px 24px'` for alignment consistency.

#### 5. Improve toggle row hover states (lines 832-850)
Add a subtle hover background (`#F8F8FB`) to each column toggle row for better interaction feedback. Currently the rows have no hover state.

#### 6. Improve main settings panel padding consistency (line 855)
Update the main settings header and content padding from `'20px'` to `'20px 24px'` for consistency with the columns sub-panel.

### Summary of Padding Changes

| Element | Before | After |
|---------|--------|-------|
| Column rows padding | `0 20px 0 4px` | `0 24px 0 12px` |
| Column sub-panel header | `20px 20px 16px` | `20px 24px 16px` |
| Search input container | `12px 20px` | `12px 24px` |
| Main settings header | `20px 20px 16px` | `20px 24px 16px` |
| Main settings content | `20px` | `20px 24px` |

### Visual Result
- Toggle switches will be fully visible with comfortable spacing from the right edge
- Drag handles will have proper left margin
- Consistent 24px horizontal padding throughout both panels
- Hover feedback on column rows for better interactivity

