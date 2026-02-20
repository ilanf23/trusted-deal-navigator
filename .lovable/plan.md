

## Fix Feed Page Layout and Match Copper Reference

### Problem 1: Page Still Cut Off (CSS Selector Bug)
The `data-full-bleed` CSS fix from the previous attempt has a bug. The AdminLayout DOM structure is:

```text
main
  +-- header (AdminLayout top bar)
  +-- div.flex-1.p-3  (padding container)
        +-- div.max-w-[1800px]  (max-width wrapper)
              +-- [data-full-bleed]  (PipelineFeed)
```

The CSS rule uses `:has(> [data-full-bleed])` which requires a **direct child**, but `[data-full-bleed]` is a grandchild of the padding container. The rule never matches, so padding is never removed.

**Fix:** Remove the `>` combinator inside `:has()` so it matches descendants:
```css
.admin-portal main > div:has([data-full-bleed]) { padding: 0 !important; overflow: visible !important; }
.admin-portal main > div > div:has([data-full-bleed]) { max-width: none !important; }
```

### Problem 2: Duplicate Top Bar
The Feed page renders its own top bar (with "Feed" title, search, +, bell) INSIDE AdminLayout, which already has a header. This creates a double header. The Feed page's top bar should also hide the AdminLayout header.

**Fix:** Extend the CSS override to hide AdminLayout's header when the Feed page is active:
```css
.admin-portal main:has([data-full-bleed]) > header { display: none !important; }
```

And adjust the height calculation from `h-[calc(100vh-3.5rem-1px)]` to `h-screen` since the AdminLayout header will be hidden.

### Problem 3: UI Detail Differences vs Copper Reference

Based on the detailed spec and screenshots, these differences need to be corrected:

**FeedRightPanel.tsx:**
- The "Invite Team Members" subtext says "collaborate with them on Copper" -- should say "collaborate with them on CLX" (this is CLX OS, not Copper)
- The "Suggested People" subtext says "auto-tracked in Copper" -- should say "auto-tracked in CLX"

**FeedLeftPanel.tsx:**
- Team avatar colors should use light purple (`bg-[#EDE9F6] text-[#5B21B6]`) per spec, not individual colors like `bg-blue-100`, `bg-orange-100`, etc. The spec says "light purple background, dark purple text initials"

**ActivityCard.tsx:**
- The `isPrivate !== undefined` check on line 101 always shows the lock icon since `isPrivate` is a boolean (always defined after `useState`). Should check `activity.isPrivate !== undefined` (the prop) or only show for email/invite types which is already handled by the `isEmailOrInvite` conditional. Fix: move lock icon inside the `isEmailOrInvite` block properly.

**PipelineFeed.tsx:**
- Height should be `h-screen` instead of `h-[calc(100vh-3.5rem-1px)]` once AdminLayout header is hidden

### File Changes

| File | Change |
|------|--------|
| `src/index.css` | Fix CSS selectors (remove `>` in `:has()`), add header hiding rule |
| `src/pages/admin/PipelineFeed.tsx` | Change height to `h-screen` |
| `src/components/feed/FeedLeftPanel.tsx` | Fix team avatar colors to uniform light purple |
| `src/components/feed/FeedRightPanel.tsx` | Replace "Copper" references with "CLX" |
| `src/components/feed/ActivityCard.tsx` | Fix lock icon conditional check |

