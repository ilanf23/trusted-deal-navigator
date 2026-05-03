# Rate Watch — Visual Redesign

**Date**: 2026-05-03
**Page**: `/admin/RateWatch.tsx`
**Status**: Design spec — pre-implementation

## Problem

Current Rate Watch page reads as childish for a financial product:

- Five pastel gradient KPI cards (slate / green / amber / blue / purple) create visual noise
- Status badges and icon backgrounds add a sixth and seventh color
- Inline expanded accordion row pushes other rows out of view, breaking comparison flow
- Tab + search + result count compete for the same horizontal real estate
- Page does not match the unified purple admin theme used in `People.tsx`, `Pipeline.tsx`, etc.

## Design direction

**Reference**: Mercury / Stripe dashboards — financial-grade gravitas, near-monochrome palette with a single brand accent and minimal semantic color, data-dense tables, restrained typography.

## Page architecture

### 1. Header strip (replaces 5 KPI cards)

- Title `Rate Watch` (18px / 600) + muted subtitle `12 borrowers · $48.2M total`
- Right-aligned actions: `Copy Link` (ghost) · `Import` (ghost) · `Add Lead` (primary purple)
- 1px `#c8bdd6` divider underneath

### 2. KPI strip — inline, monochrome

Four numbers in a row, separated by thin vertical rules, no card backgrounds:

```
12         3              2          $48.2M
TOTAL      • READY        CLOSE      LOAN VALUE
```

- Numbers: 24px / 600 / tabular-nums / `#1a1a1a`
- Labels: 11px / 500 / uppercase / `#6b6280`
- "Ready" prefixed with a 6px green dot — only accent on the strip

### 3. Filter bar (single line)

- Segmented pill tabs: `All · Ready · Close · Watching` (active = purple bg, white text)
- Pill search bar with magnifying glass icon (per CRM convention)
- Right-aligned: `12 results` muted

### 4. Table (the page)

- Native HTML table, purple header `#eee6f6`, 13px text, sticky first column
- Drag-to-reorder columns via `useColumnOrder` + `<DraggableColumnsContext>` recipe
- Columns: ☐ · Status · Borrower · Property · Rate · Target · **Gap** · Loan Amt · Maturity · Last Contact · ⋯

**Gap is the hero column**:
- Wider, right-aligned tabular-nums
- `Met` in green `#0f7a3e` when ≤ 0
- `0.32%` in amber `#a45c00` when < 0.5
- `+0.84%` in muted gray otherwise

**Status column** = single 8px dot (green / amber / gray). Tooltip on hover replaces the badge pill.

**Row interactions**:
- Hover: `#faf7fd`
- Selected: `#eee6f6`
- Click: opens right-side detail panel (does NOT inline-expand)

### 5. Side detail panel (replaces inline accordion)

Slides in from right when row clicked. Table compresses to 60% width, panel takes 40%.

- **Header**: Borrower name (18px / 600) + company (13px muted) + close `×`
- **Action row**: `Email` · `AI Email` (sparkle, purple ghost) · `Call`
- **Hero stat block**: three columns separated by thin rules
  ```
  CURRENT      TARGET       GAP
  7.50%        6.00%        +1.50%
  ```
  Plus a plain-language summary line: *"Rate needs to drop 1.50% to hit target — currently watching."*
- **Three stacked sections** (no card backgrounds, just `#e8e0f3` dividers):
  1. **Loan** — Type, Rate Type, Index/Spread, Term, Amortization, Penalty, Lender Type
  2. **Collateral** — Type, Value, Location, Occupancy, Owner-Occupied %, Est. Cash Flow
  3. **Status** — Email Confirmed, Initial Review, Enrolled, Last Contacted, Notes
- Each row: label left (11px uppercase muted), value right (13px charcoal). Empty values omitted entirely.

### 6. Bulk actions

When ≥1 row selected, filter bar morphs into a purple toolbar:

> `3 selected` · `Send AI Email` · `Mark Contacted` · `Export` · `Remove from watch` · `× Clear`

Matches `PipelineBulkToolbar` pattern.

### 7. Empty / loading / error states

- **Empty (no entries)**: centered `TrendingDown` icon, `No leads in Rate Watch yet`, primary `Add Lead` button, ghost `Copy questionnaire link`
- **Empty filter**: `No matches for "foo"` + `Clear filters` link
- **Loading**: 6 skeleton rows with shimmer at 8% opacity
- **Error**: inline alert at top of table, retry button

## Color system (final)

Total palette: **5 colors**.

| Role | Token | Hex |
|------|-------|-----|
| Surface — page | `bg-page` | `#ffffff` |
| Surface — hover | `bg-hover` | `#faf7fd` |
| Surface — selected / header | `bg-selected` | `#eee6f6` |
| Border — thin | `border-thin` | `#e8e0f3` |
| Border — strong | `border-strong` | `#c8bdd6` |
| Text — primary | `text-primary` | `#1a1a1a` |
| Text — muted | `text-muted` | `#6b6280` |
| Text — faint | `text-faint` | `#9b91a8` |
| Brand — purple | `brand` | `#3b2778` |
| Semantic — Ready | `green` | `#0f7a3e` |
| Semantic — Close | `amber` | `#a45c00` |

No gradients. No pastels. No icon backgrounds.

## Typography

- Headlines / KPI numbers: Inter 24px / 600 / tabular-nums
- Body: Inter 13px / 400
- Labels: Inter 11px / 500 / uppercase / 0.04em tracking
- Table numbers: Inter 13px / 500 / tabular-nums

## What's removed

- 5 gradient KPI cards → 1 thin inline strip
- Pastel green / amber / blue / purple tile colors → monochrome + 1 accent
- Status badge pills → 8px dot
- Inline expanded accordion row → right-side detail panel
- Tab + search at default size → tighter, single-line filter bar

## Implementation notes

- Reuse `useColumnOrder` hook + `<DraggableColumnsContext>` (see admin/CLAUDE.md recipe)
- Reference `People.tsx` for native table + sticky column + purple theme
- Reuse `PipelineBulkToolbar` pattern for bulk actions
- Detail panel can adopt `PeopleDetailPanel` skeleton
- All existing data fetching (`rate_watch` query, `availableLeads`, mutations) stays as-is — this is purely a presentational redesign

## Open questions

- Do we want a small **rate trend sparkline** (current vs. target over last 90 days) in the detail panel? Not in current data model — would need new table or external rate feed. Defer to follow-up.
- Should the row click open a detail panel OR navigate to `/admin/ratewatch/expanded-view/:id` (full page)? Recommendation: panel for speed of triage; keep expanded-view route open for future deep-dive use.
