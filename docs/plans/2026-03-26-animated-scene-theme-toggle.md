---

# Animated Scene Theme Toggle

## Overview

Replace the current pill-shaped Sun/Moon toggle in the admin header with an animated landscape scene toggle. The toggle will show a sunny daytime scene (blue sky, sun, clouds, rolling hills) that smoothly morphs into a starry night scene (dark sky, moon, twinkling stars, same hill silhouette) when switching themes. Built entirely with inline SVG and CSS transitions - no external images.

## Context

- Files involved:
  - `src/components/admin/AdminLayout.tsx` (lines 150-175) - current toggle location
  - `src/components/ui/SceneThemeToggle.tsx` - new component to create
  - `src/index.css` - keyframe animations for stars/clouds
- Related patterns: uses `useTheme()` from next-themes (already set up in App.tsx)
- Dependencies: none beyond what's already installed (lucide-react not needed for this)

## Development Approach

- Code first, visual iteration
- Single task since this is a self-contained UI component swap

## Implementation Steps

### Task 1: Create the animated scene toggle component

**Files:**
- Create: `src/components/ui/SceneThemeToggle.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/index.css`

- [x] Create `SceneThemeToggle.tsx` with an SVG-based landscape scene inside a clickable button:
  - Rounded rectangle container (~120x48px, responsive)
  - SVG scene with layers: sky gradient background, sun/moon circle, clouds (light) / stars (dark), rolling hill silhouette at the bottom
  - Light state: warm blue-to-cyan sky gradient, golden sun positioned upper-left, 2-3 small white clouds floating, green hill silhouette
  - Dark state: deep navy-to-indigo sky gradient, silver moon positioned upper-right, 5-8 twinkling stars, dark hill silhouette
  - CSS transitions (600-800ms) on all scene elements: sky gradient shift, sun slides down/fades as moon slides up/fades in, clouds fade out as stars fade in, hill color darkens
  - Star twinkle animation via CSS keyframes (opacity pulse, staggered delays)
  - Cloud drift animation via CSS keyframes (subtle horizontal float)
  - Proper accessibility: role="switch", aria-checked, aria-label, focus-visible ring, keyboard support
- [x] Add CSS keyframe animations to `src/index.css`: `@keyframes twinkle` (star opacity pulse), `@keyframes cloud-drift` (subtle horizontal movement)
- [x] In `AdminLayout.tsx`, replace the current inline toggle button (lines 150-175) with `<SceneThemeToggle />` import and usage
- [x] Verify the toggle works in both light and dark mode, transitions are smooth, and the component fits well in the admin header bar

### Task 2: Verify build and lint

- [x] Run `npm run build` - must pass with no errors
- [x] Run `npm run lint` - must pass with no errors (no new errors introduced; pre-existing errors in unrelated files)

### Task 3: Update documentation

- [ ] Move this plan to `docs/plans/completed/`
