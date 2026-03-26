# Redesign Admin Call Page Layout

## Overview

Reorganize the admin Calls page (src/pages/admin/Calls.tsx) to have a clean, logical layout instead of the current spread-out 2/3 + 1/3 grid. The new layout groups related information together using a 2-column approach: left column for the dialer and active call status, right column for call history and lead details. All existing functionality stays identical — this is purely a layout/design pass.

## Context

- Files involved:
  - Modify: `src/pages/admin/Calls.tsx` (main page — all layout changes happen here)
  - Read-only reference: `src/components/evan/OutboundCallCard.tsx` (dialer card, no changes)
- Related patterns: existing shadcn Card/Badge/ScrollArea usage, Tailwind grid layout
- Dependencies: none — pure frontend layout change

## Development Approach

- No tests (project has no automated tests per CLAUDE.md)
- Single file change — all layout code lives in Calls.tsx
- Keep all state, queries, mutations, dialogs, and event handlers untouched
- Only restructure the JSX return block (the grid and card arrangement)

## Implementation Steps

### Task 1: Restructure the page grid into a cleaner 2-column layout

**Files:**
- Modify: `src/pages/admin/Calls.tsx`

New layout (top to bottom, left to right):

**Top bar row (full width):**
- Phone number badge (right-aligned, already exists) — keep as-is

**Main 2-column grid:**

Left column (lg:col-span-2, ~40% width):
1. Active Call card (compact — current call status + phone number)
2. OutboundCallCard dialer (moved from right column)
3. Matched Lead / Caller Information card (moved from left column, below dialer)

Right column (lg:col-span-3, ~60% width):
1. Call History card (full height of right column, taller scroll area)

This groups the "action" items (active call, dialer, lead info) on the left as a command panel, and gives call history the dominant screen space on the right since it's the most-used section.

- [x] Restructure the grid from `grid-cols-1 lg:grid-cols-3` to `grid-cols-1 lg:grid-cols-5` (for better proportional control)
- [x] Move OutboundCallCard to left column (lg:col-span-2), placed after Active Call card
- [x] Move Caller Information card below OutboundCallCard in left column
- [x] Make Call History the sole card in right column (lg:col-span-3) with increased scroll height
- [x] Increase Call History ScrollArea from h-[430px] to h-[calc(100vh-12rem)] so it fills available vertical space
- [x] Tighten spacing: reduce outer `space-y-6` to `space-y-4`, reduce inner card gaps
- [x] Make Active Call card more compact when no active call (smaller padding, single-line empty state)

### Task 2: Polish card styling for visual hierarchy

**Files:**
- Modify: `src/pages/admin/Calls.tsx`

- [ ] Add subtle section labels or dividers between the left-column cards for visual grouping
- [ ] Make the Active Call card's empty state more minimal (reduce from full card to a slim status bar style)
- [ ] Ensure all cards have consistent border-radius, padding, and header sizing
- [ ] Verify responsive behavior: on mobile (single column), stack in order: Active Call, Dialer, Lead Info, Call History

### Task 3: Verify build and lint

**Files:**
- Check: `src/pages/admin/Calls.tsx`

- [ ] Run `npm run build` — must pass with no errors
- [ ] Run `npm run lint` — must pass with no errors

### Task 4: Move plan to completed

- [ ] Move this plan to `docs/plans/completed/`
