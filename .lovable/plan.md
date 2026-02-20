

## Fix Logo Readability on Small Screens

### Problem
The header logo uses extremely large height classes (`h-40` = 160px, `md:h-60` = 240px) inside a header that is only `h-14` (56px) / `h-16` (64px) tall. The logo overflows its container and on smaller viewports it gets compressed and becomes unreadable, as shown in the screenshot.

### Solution
Constrain the logo to reasonable sizes that fit within the header while remaining readable at all breakpoints:

### File Change: `src/components/layout/Header.tsx`

**Line 42** -- Change the logo `img` classes:

- **From:** `className="h-40 md:h-60 mx-auto"`
- **To:** `className="h-10 md:h-12 w-auto"`

This sets the logo to 40px on mobile and 48px on desktop -- fitting comfortably inside the 56px/64px header while staying crisp and readable. The `w-auto` ensures the aspect ratio is preserved.

Also remove the `mt-[0.375rem]` on the parent `Link` since it was compensating for the oversized image -- the logo will now naturally center within the flex container.

