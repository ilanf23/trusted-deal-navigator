

# Fix: Sidebar Scroll Position Resets on Mobile Navigation

## Problem
When the sidebar is in mobile/sheet mode (shrunken view), clicking a navigation link closes the sidebar sheet. The next time it opens, the scroll position resets to the top because the Sheet component unmounts and remounts its content.

## Solution
Preserve the sidebar's scroll position across open/close cycles by:

1. Adding a ref to the scrollable `SidebarContent` container in `AdminSidebar.tsx`
2. Saving the scroll position before the mobile sheet closes (in the `closeMobileMenu` handler)
3. Restoring the saved scroll position when the sheet reopens (via an effect that watches `openMobile` state)

## Technical Details

**File: `src/components/admin/AdminSidebar.tsx`**

- Add a `useRef<number>` to store the last scroll position and a `useRef<HTMLDivElement>` for the scrollable nav container
- Update `closeMobileMenu` to capture `scrollTop` before calling `setOpenMobile(false)`
- Add a `useEffect` that, when `openMobile` transitions to `true`, restores the scroll position on the nav container after a short `requestAnimationFrame` delay (to ensure the DOM has rendered)
- Attach the container ref to the wrapping `<nav>` or `<SidebarContent>` element

This is a single-file change to `src/components/admin/AdminSidebar.tsx` with no new dependencies.

