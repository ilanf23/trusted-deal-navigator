# Revenue & Sales Rep Dashboard Overhaul

## Overview

Complete redesign of both the SuperAdmin revenue dashboard and employee sales rep dashboard with a data-dense executive style (Datadog/Mixpanel). Replaces the basic Recharts line chart with combo charts (bar + line), adds activity heatmaps, introduces compact KPI tiles with trend arrows and sparklines, unifies filtering logic, and ensures all metrics pull from correct Supabase tables.

## Context

- Files involved:
  - `src/pages/admin/SuperAdminDashboard.tsx` (418 lines) — SuperAdmin dashboard page
  - `src/pages/admin/Dashboard.tsx` (618 lines) — Employee sales rep dashboard page
  - `src/components/employee/dashboard/RevenueChart.tsx` (506 lines) — Current basic line chart
  - `src/components/admin/dashboard/useDashboardData.ts` (347 lines) — Employee dashboard data hook
  - `src/hooks/useSuperAdminDashboard.ts` (173 lines) — SuperAdmin dashboard data hook
  - `src/components/employee/dashboard/NudgesWidget.tsx` — Nudges widget
  - `src/components/employee/dashboard/TopActions.tsx` — Top actions widget
- Related patterns: Recharts used throughout, TanStack Query for data fetching, shadcn/ui components, Tailwind styling
- Dependencies: Recharts (already installed), Framer Motion (already installed), date-fns (already installed)
- Supabase tables: `potential`, `communications`, `tasks`, `revenue_targets`, `v_pipeline_metrics`, `v_team_performance`, `v_referral_analytics`, `dashboard_weekly_scorecard`, `team_monthly_goals`

## Development Approach

- Regular development (code first)
- Complete each task fully before moving to the next
- No automated test suite exists — verify via `npm run build` and `npm run lint` after each task
- Reuse existing Recharts library — no new chart libraries
- Reuse shadcn/ui primitives and Tailwind utilities
- Maintain real-time subscriptions on SuperAdmin dashboard

## Implementation Steps

### Task 1: Build CompactKPITile component

**Files:**
- Create: `src/components/admin/dashboard/CompactKPITile.tsx`

- [x] Create a reusable KPI tile component with: metric label, current value (large), trend arrow (up/down/neutral with color), delta value (absolute + percentage), inline sparkline (last 6-12 data points rendered as a tiny SVG path), and optional comparison label (vs last period / vs target)
- [x] Support variants: currency, percentage, count, and days — each with appropriate formatting
- [x] Use Framer Motion for animated number transitions on value changes
- [x] Style with Tailwind: compact card with subtle border, muted background, color-coded trend indicators (green up, red down, gray neutral)
- [x] Run `npm run build && npm run lint` — must pass

### Task 2: Build RevenueComboChart component

**Files:**
- Create: `src/components/admin/dashboard/RevenueComboChart.tsx`

- [ ] Build a Recharts ComposedChart with: bars for period revenue (monthly/weekly/daily buckets), line overlay for cumulative revenue, second line for target/goal pace, optional dashed line for previous period comparison
- [ ] Add interactive features: hover tooltip showing all series values with formatted currency, click-to-drill into a period (emits callback), reference lines for quarterly targets
- [ ] Include a compact filter bar directly in the chart header: time range segmented control (MTD/QTD/YTD/12M/All), granularity auto-derived from range, scope toggle (company/personal), and source multi-select popover
- [ ] Style the chart: dark grid lines on light background, muted axis labels, color palette using 3-4 distinguishable colors with good contrast, bar opacity at 0.7 with line at full opacity
- [ ] Responsive: chart adapts to container width, legend collapses on small screens
- [ ] Run `npm run build && npm run lint` — must pass

### Task 3: Build ActivityHeatmap component

**Files:**
- Create: `src/components/admin/dashboard/ActivityHeatmap.tsx`

- [ ] Create a GitHub-contribution-style heatmap showing deal activity intensity by day over the last 90 days (or configurable range)
- [ ] Data: count of deal events per day from `potential` (stage changes, won_at, created_at) and `communications` (calls, emails) — accept pre-aggregated data via props
- [ ] Render as an SVG grid: columns = weeks, rows = weekdays (Mon-Sun), cells colored by intensity (4-5 levels from transparent to deep purple)
- [ ] Tooltip on hover: date + event count + breakdown (deals created, stage changes, communications)
- [ ] Include summary row below: total events, most active day of week, current streak
- [ ] Run `npm run build && npm run lint` — must pass

### Task 4: Build PipelineStageBar component

**Files:**
- Create: `src/components/admin/dashboard/PipelineStageBar.tsx`

- [ ] Create a horizontal stacked bar showing pipeline composition by stage with deal counts and dollar values
- [ ] Each segment: colored by stage, shows deal count on hover, proportional width by value
- [ ] Below the bar: legend with stage name, count, total value, and weighted forecast per stage
- [ ] Support click-to-filter (emits stage callback for parent to handle)
- [ ] Run `npm run build && npm run lint` — must pass

### Task 5: Audit and fix data layer — useDashboardData hook

**Files:**
- Modify: `src/components/admin/dashboard/useDashboardData.ts`

- [ ] Audit every metric calculation against the Supabase schema: verify `potential.potential_revenue` vs `potential.deal_value` usage is consistent and correct (currently has fallback `deal_value * 0.01` or `deal_value * 0.02` which may be wrong for some deal types)
- [ ] Fix win rate calculation: currently uses `funded / total leads` — verify denominator should be total leads vs leads that reached a decision (won + lost, excluding abandoned/open)
- [ ] Fix confidence score weights: document what each weight means and verify the blend (40% forecast, 30% progress, 20% pipeline, 10% momentum) reflects actual business priority
- [ ] Replace hardcoded `ANNUAL_GOAL = 1500000` with a query to `revenue_targets` table so the goal is database-driven
- [ ] Add new derived metrics needed for the redesign: revenue by source breakdown, period-over-period growth per metric, daily activity counts for heatmap, sparkline data arrays for KPI tiles (last 12 data points per metric)
- [ ] Ensure all date filtering uses consistent timezone handling (currently uses `new Date()` which is local time — align with Supabase UTC storage)
- [ ] Run `npm run build && npm run lint` — must pass

### Task 6: Audit and fix data layer — useSuperAdminDashboard hook

**Files:**
- Modify: `src/hooks/useSuperAdminDashboard.ts`

- [ ] Verify `revenue_targets` query returns correct MTD vs YTD values and that the confidence percentage is calculated server-side correctly
- [ ] Add new queries for: company-wide daily activity data (for heatmap), per-metric sparkline arrays (last 12 periods), revenue by team member for comparison chart
- [ ] Remove hardcoded team member URL mapping (lines ~47-58) — derive from `users` table `dashboard_url` and `position` columns
- [ ] Add period-over-period delta calculations for all KPI metrics (current vs previous period)
- [ ] Run `npm run build && npm run lint` — must pass

### Task 7: Redesign Employee Dashboard page

**Files:**
- Modify: `src/pages/admin/Dashboard.tsx`
- Modify: `src/components/employee/dashboard/RevenueChart.tsx` (replace internals or swap out)

- [ ] Replace the 5 current KPI cards with CompactKPITile components: Revenue (currency, with sparkline), Deals Closed (count), Pipeline Value (currency), Win Rate (percentage), Goal Progress (percentage with progress bar variant)
- [ ] Replace the current RevenueChart with the new RevenueComboChart — wire up data from useDashboardData, pass filter callbacks
- [ ] Add ActivityHeatmap below the chart showing the sales rep's personal activity over 90 days
- [ ] Add PipelineStageBar component showing the rep's current pipeline composition
- [ ] Consolidate filtering: single unified filter bar at page top with time period (MTD/QTD/YTD), scope stays chart-specific, remove redundant per-section filters
- [ ] Reorganize layout into a tighter grid: KPI tiles in a single row (5 across on desktop, wrapping on mobile), full-width combo chart, two-column layout below (left: heatmap + pipeline bar + nudges, right: hot deals + schedule + quick links)
- [ ] Keep existing NudgesWidget, TopActions, Hot Deals, Commission Calculator, and Quick Links — but tighten their styling to match the new data-dense aesthetic (smaller padding, compact typography)
- [ ] Run `npm run build && npm run lint` — must pass

### Task 8: Redesign SuperAdmin Dashboard page

**Files:**
- Modify: `src/pages/admin/SuperAdminDashboard.tsx`

- [ ] Replace top metric cards with CompactKPITile components: Revenue YTD (currency + sparkline), Pace vs Plan (percentage + trend), Weighted Forecast (currency + trend), Pipeline Total (currency + deal count), Team Win Rate (percentage), Active Deals (count)
- [ ] Add a full-width RevenueComboChart showing company-wide revenue — bars for monthly revenue, line for cumulative, goal line from revenue_targets table
- [ ] Add ActivityHeatmap showing company-wide deal activity (all team members combined)
- [ ] Replace the plain Pipeline by Stage table with the PipelineStageBar component plus a detailed expandable table below it
- [ ] Redesign Team Performance section: keep the table but add mini sparklines inline for each team member's revenue trend, color-code conversion rates (green > 20%, yellow 10-20%, red < 10%)
- [ ] Consolidate filtering: unified filter bar at page top (time period: MTD/QTD/YTD/12M, with a team member multi-select to filter all sections)
- [ ] Keep the Confidence banner but redesign it: horizontal bar with color gradient (red to green), breakdown metrics as compact pills below
- [ ] Keep Referral Engine and Weekly Scorecard sections with tightened styling
- [ ] Run `npm run build && npm run lint` — must pass

### Task 9: Polish and visual consistency pass

**Files:**
- Modify: `src/pages/admin/SuperAdminDashboard.tsx`
- Modify: `src/pages/admin/Dashboard.tsx`
- Modify: `src/components/admin/dashboard/CompactKPITile.tsx`
- Modify: `src/components/admin/dashboard/RevenueComboChart.tsx`
- Modify: `src/components/admin/dashboard/ActivityHeatmap.tsx`
- Modify: `src/components/admin/dashboard/PipelineStageBar.tsx`

- [ ] Ensure consistent spacing, typography, and color usage across both dashboards
- [ ] Verify dark mode compatibility (the app supports theme toggle) — all new components must work in both light and dark modes
- [ ] Test responsive behavior: desktop (1440px+), laptop (1024px), tablet (768px) — KPI tiles should wrap gracefully, charts should resize, heatmap should scroll horizontally on small screens
- [ ] Add loading skeletons for all new components (use shadcn Skeleton component) matching the final layout dimensions
- [ ] Verify Framer Motion animations are subtle and performant (no layout thrash, reduced motion media query respected)
- [ ] Run `npm run build && npm run lint` — must pass

### Task 10: Verify acceptance criteria

- [ ] Run `npm run build` — must pass with no errors
- [ ] Run `npm run lint` — must pass with no errors
- [ ] Verify both dashboards render correctly with real Supabase data
- [ ] Verify all KPI tiles show trend arrows and sparklines
- [ ] Verify combo chart displays bars + lines with working filters
- [ ] Verify heatmap renders activity data
- [ ] Verify filters are unified and consistent across both dashboards

### Task 11: Update documentation

- [ ] Update CLAUDE.md if new patterns or component conventions were introduced
- [ ] Move this plan to `docs/plans/completed/`
