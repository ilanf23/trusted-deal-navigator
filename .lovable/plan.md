
# Fix Sidebar and Page Layout on Small/Mobile Views

## Problem Analysis

From the screenshot and code review, there are two overlapping issues on small/narrow viewports:

### Issue 1 — Sidebar Sheet overlaps page content incorrectly on mobile
The Shadcn `Sidebar` component correctly renders a `Sheet` on mobile (`isMobile` = true, i.e., viewport < 768px). However, the `AdminLayout` wraps everything in `<div className="min-h-screen flex w-full">` which does not account for the Sheet overlay correctly. On very small views (like in the Lovable editor preview pane, which is ~480px wide), the Sheet appears to expand ON TOP of the page without a proper backdrop close behavior — it looks "broken" because sidebar items and the page content are both partially visible simultaneously.

### Issue 2 — Header SidebarTrigger margin
The header has `ml-0 md:ml-12` on the trigger container. On desktop, `ml-12` creates space for the collapsed icon sidebar (3.5rem wide). But at intermediate sizes (768px–900px), the sidebar IS visible but the 3rem margin pushes header content to overlap. On mobile, the trigger is fine but the sidebar Sheet takes full-screen width.

### Issue 3 — Missing `overflow-x-hidden` on outer wrapper
The outer `div` doesn't prevent horizontal overflow, which causes horizontal scrolling on small screens when content is wider than viewport.

### Issue 4 — Sidebar Sheet auto-close on navigation
On mobile, after tapping a nav link inside the Sheet sidebar, the Sheet stays open because `Link` navigation doesn't trigger the Sheet's `onOpenChange`. This makes it look "stuck".

## Root Cause in Code

In `AdminSidebar.tsx`, all nav links are plain `<Link>` components — they don't call `setOpenMobile(false)` from the `useSidebar()` hook when clicked on mobile. The Shadcn sidebar Sheet only closes when the user taps the backdrop or the trigger button.

In `AdminLayout.tsx`:
- Line 28: `<div className="min-h-screen flex w-full admin-portal bg-background">` — needs `overflow-x-hidden`
- Line 36: `<main className="flex-1 flex flex-col min-h-screen w-full overflow-x-hidden">` — this is fine
- Line 39: `<div className="flex items-center gap-2 md:gap-5 ml-0 md:ml-12">` — the `md:ml-12` pushes the trigger right on medium screens; since the sidebar is fixed-positioned and overlaps, this should be `md:ml-0` or removed entirely, as the `SidebarTrigger` itself handles placement

## Fix Plan

### 1. `src/components/admin/AdminSidebar.tsx` — Auto-close Sheet on mobile navigation

Extract `setOpenMobile` from the `useSidebar()` hook and call it on every nav Link click when on mobile. This ensures tapping a link in the mobile Sheet automatically closes the sidebar.

```tsx
const { state, isMobile, setOpenMobile } = useSidebar();

// In every Link:
<Link
  to={item.url}
  onClick={() => isMobile && setOpenMobile(false)}
  ...
>
```

This needs to be applied to:
- All `noCollapse` section `<Link>` elements (lines ~389, ~428)
- All collapsible section `<Link>` elements (lines ~546, ~527)
- Sub-item `<Link>` elements

### 2. `src/components/admin/AdminLayout.tsx` — Fix outer wrapper overflow and header margin

**Change 1**: Add `overflow-x-hidden` to the outer flex wrapper to prevent horizontal scroll bleed on small screens.

```tsx
// Line 28 - BEFORE:
<div className="min-h-screen flex w-full admin-portal bg-background">

// AFTER:
<div className="min-h-screen flex w-full admin-portal bg-background overflow-x-hidden">
```

**Change 2**: Remove the `md:ml-12` from the header trigger container. The sidebar is fixed-positioned, so the header doesn't need a left margin to clear it. The `SidebarTrigger` should sit at the natural left edge of the header.

```tsx
// Line 39 - BEFORE:
<div className="flex items-center gap-2 md:gap-5 ml-0 md:ml-12">

// AFTER:
<div className="flex items-center gap-2 md:gap-5">
```

**Change 3**: Ensure the main content area properly handles small screen padding:

```tsx
// Line 109 - BEFORE:
<div className="flex-1 p-4 md:p-6 lg:p-8 xl:p-10 animate-fade-in overflow-x-auto">

// AFTER:
<div className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 xl:p-10 animate-fade-in overflow-x-hidden">
```

## Files to Change

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Add `overflow-x-hidden` to outer div, remove `md:ml-12` from header trigger container, change content padding to `p-3 sm:p-4` and `overflow-x-hidden` |
| `src/components/admin/AdminSidebar.tsx` | Extract `isMobile` + `setOpenMobile` from `useSidebar()`, add `onClick={() => isMobile && setOpenMobile(false)}` to all nav `<Link>` elements |

## What This Fixes

- Tapping a sidebar link on mobile now automatically closes the Sheet overlay
- No horizontal overflow/scrolling on small screens
- Header trigger is properly positioned without the extra `md:ml-12` margin that caused misalignment in narrow views
- Content padding is slightly reduced on very small screens (`p-3`) for better space usage
