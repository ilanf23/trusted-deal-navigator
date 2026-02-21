

## Dark Mode for Feed Page

### Problem
All four feed components (`FeedLeftPanel`, `FeedCenter`, `FeedRightPanel`, `ActivityCard`) use hardcoded light-mode hex colors (e.g., `bg-white`, `text-[#111827]`, `border-[#E5E7EB]`, `bg-[#F5F5F7]`). These do not respond to the dark mode theme toggle already available in the admin header.

### Solution
Replace all hardcoded color values with semantic Tailwind tokens (`bg-card`, `text-foreground`, `border-border`, `bg-muted`, `text-muted-foreground`, etc.) that automatically adapt to the active theme. This matches the pattern already used across the rest of the admin portal.

### Files to Change

**1. `src/components/feed/FeedLeftPanel.tsx`**
- `bg-white` -> `bg-card`
- `border-[#E5E7EB]` -> `border-border`
- `text-[#111827]` -> `text-foreground`
- `text-[#6B7280]` -> `text-muted-foreground`
- `bg-[#F5F5F7]` -> `bg-muted`
- `text-[#9CA3AF]` -> `text-muted-foreground/60`
- `bg-[#EDEAF6]` / `text-[#3B1F8C]` (active filter) -> `bg-primary/10 text-primary`
- `hover:bg-[#F5F5F7]` -> `hover:bg-muted`
- Team avatar colors kept as-is (purple brand color, acceptable hardcoded UI config)

**2. `src/components/feed/FeedCenter.tsx`**
- `bg-[#F5F5F7]` -> `bg-muted/50`
- `bg-white` (tab bar) -> `bg-card`
- `border-[#E5E7EB]` -> `border-border`
- `text-[#111827]` -> `text-foreground`
- `text-[#6B7280]` -> `text-muted-foreground`
- `text-[#374151]` -> `text-foreground`

**3. `src/components/feed/FeedRightPanel.tsx`**
- All `bg-white` -> `bg-card`
- `border-[#E5E7EB]` -> `border-border`
- `text-[#111827]` -> `text-foreground`
- `text-[#6B7280]` -> `text-muted-foreground`
- `text-[#9CA3AF]` -> `text-muted-foreground/60`
- `text-[#374151]` -> `text-foreground`
- `bg-[#E5E7EB]` (avatar placeholder) -> `bg-muted`
- `border-[#F3F4F6]` -> `border-border`
- `hover:bg-[#F9FAFB]` -> `hover:bg-muted`
- `border-[#111827]` (button borders) -> `border-foreground`
- Card shadows: add `dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)]` variant

**4. `src/components/feed/ActivityCard.tsx`**
- `bg-white` -> `bg-card`
- `shadow-[0_1px_4px_rgba(0,0,0,0.08)]` -> add dark variant
- `text-[#111827]` -> `text-foreground`
- `text-[#6B7280]` -> `text-muted-foreground`
- `text-[#9CA3AF]` -> `text-muted-foreground/60`
- `text-[#374151]` -> `text-foreground`
- `bg-[#F3F4F6]` (attachment chips, thread badge) -> `bg-muted`
- `border-[#E5E7EB]` -> `border-border`
- `hover:bg-[#F3F4F6]` -> `hover:bg-muted`
- Avatar colors (blue-600, amber-600, etc.) stay as-is -- they are brand/UI config

### What stays the same
- Brand accent colors (purple `#5B21B6`, `#2D1B4E` buttons) remain hardcoded -- these are intentional brand colors
- Avatar background colors remain hardcoded -- UI configuration
- The `PipelineFeed.tsx` page wrapper (already converted to semantic tokens in a prior change)

