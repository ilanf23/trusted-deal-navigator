

## Redesign: Company-Wide Revenue Hero Widget

### What's Changing

The current blue gradient hero card on Evan's dashboard will be completely rebuilt as a much larger, visually striking company-wide revenue overview. It will pull from the `team_funded_deals` table (which has real data for Evan, Wendy, Brad, and Adam) instead of just Evan's leads.

### Design (inspired by your screenshot)

The new widget will be a full-width hero section with:

**Left Side:**
- "2026 REVENUE GOAL" header
- Large revenue figure vs $1.5M goal
- Motivational momentum message with remaining amount

**Right Side:**
- Cumulative revenue line chart (bigger, ~300px tall)
- MTD/YTD toggle
- Actual vs Trend legend
- Monthly cumulative data points

**Bottom Stats Bar (spanning full width):**
- YTD Revenue (with % of goal)
- Monthly Avg (with active months count)
- Best Month (with amount)
- Deals Closed (with avg deal size)

**Key improvements:**
- Data sourced from `team_funded_deals` (company-wide, all reps)
- Much taller chart area (~300px vs current 220px)
- Cleaner layout with proper visual hierarchy
- Grouped monthly revenue from all reps, not just Evan

### Technical Changes

**1. Replace the `RoadTo1Point5M` component** (`src/components/evan/dashboard/RoadTo1Point5M.tsx`)
- Complete rewrite as `CompanyRevenueHero`
- Uses `team_funded_deals` table (already queried)
- Builds monthly cumulative chart data from funded deals
- Includes MTD/YTD toggle, line chart with area fill, trend line
- Stats footer with YTD Revenue, Monthly Avg, Best Month, Deals Closed
- Blue gradient background matching brand (#0066FF)
- Uses recharts `ComposedChart` with `Area`, `Line`, `ReferenceLine`

**2. Update EvansPage.tsx** (`src/pages/admin/EvansPage.tsx`)
- Remove the inline hero card (lines 551-761, ~210 lines of inline chart code)
- Import and use the new `CompanyRevenueHero` component instead
- Pass `timePeriod` and `chartPeriod` + setters as props
- Remove the now-unused `chartRevenueData` and `chartStats` memos (they'll move into the component)
- This significantly cleans up the page file

### Data Flow

The component will:
1. Query `team_funded_deals` with date filter based on YTD/MTD
2. Group deals by month (YTD) or day (MTD) and calculate cumulative revenue
3. Show total company revenue vs $1.5M goal
4. Display a trend line from first data point to current total

### No database changes needed -- `team_funded_deals` already has the right schema and data.

