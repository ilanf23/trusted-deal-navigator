# Scorecard

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/scorecard`
**Source file:** `src/pages/admin/Scorecard.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

The rep's personal performance dashboard — a single screen showing activity volume (calls, emails, messages), conversion rates between pipeline stages, and trend lines vs. prior periods. Used for weekly self-review and for founder 1:1s.

## Primary user

Sales rep reviewing their own week / month / quarter. Secondary: founders comparing scorecards across the team.

## Entry points

- Sidebar nav: **Workflow → Scorecard**
- Drill-through from the Score Sheet sub-route (`/admin/scorecard/score-sheet`)

## What the user can do here

- Pick a time period (week, month, year) and year
- See KPI tiles: calls placed, emails sent, leads added, deals won, etc.
- See pipeline conversion funnel with stage-to-stage rates
- Compare current period vs. prior period (trend arrows)
- Drill into a metric to see the underlying records

## Key business rules

- Period boundaries follow ISO week (Monday start) for week views
- Counts are pulled live from source tables — no nightly snapshot
- "Won" deals = `deal_outcome = 'won'` from `potential` / `underwriting` / `lender_management`
- Trend comparisons always reference the equivalent prior period (last week vs this week, etc.)
- A rep's numbers include leads owned by them; founders see team-wide rollups

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Calls placed | `evan_communications` filtered by direction + user | |
| Emails sent | `outbound_emails` | |
| Leads added | `potential.created_at` | |
| Stage conversions | Stage timestamps on `potential` / `underwriting` / `lender_management` | |
| Deals won | `deal_outcome = 'won'` rows | |

## User flows

### 1. Weekly review
1. Open Scorecard → defaults to current week
2. Scan KPI tiles vs prior week
3. Click *Score Sheet* for a more detailed breakdown
4. Click a number to see the records behind it

### 2. Compare months
1. Switch period selector to *Month* + pick month/year
2. KPI tiles re-render with monthly aggregates
3. Conversion funnel updates accordingly

## Edge cases & known gaps

- Live counts can be slow on long ranges (full year)
- No export — must screenshot for sharing
- Won/lost timestamps depend on `deal_outcome` being set correctly; missing data skews conversion
- No per-deal-type breakdown (CRE vs working capital, etc.)

---

## Technical anchors

### Components used
- `src/components/admin/scorecard/PipelineConnectors.tsx`
- Page-level KPI tiles, `Card`, `Badge`, `Select`

### Hooks / contexts
- TanStack Query directly against Supabase
- `useTeamMember` — current rep
- `useAdminTopBar`, `usePageDatabases`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `evan_communications` | ✓ | — |
| `outbound_emails` | ✓ | — |
| `potential`, `underwriting`, `lender_management` | ✓ | — |
| `tasks` | ✓ | — |

### Edge functions
- None — direct queries

### Permissions
- Route gate: `AdminRoute`
- Rep sees own numbers; founders see team rollups

## Open questions

- [ ] Export scorecard as PDF/PNG for sharing?
- [ ] Deal-type breakdown (CRE vs WC vs BA)?
- [ ] Pre-computed daily snapshot for long-range queries?
- [ ] Configurable targets (calls/week goal) with progress bars?
