

## Upgrade the Existing Company Revenue Hero Chart

### Overview

Enhance the existing `CompanyRevenueHero` component in-place with all the requested advanced features -- forecasting, interactive legend, health indicators, KPI badges, additional timeframes, and more -- rather than having a separate chart. Also remove the now-unnecessary `RevenueProjectionChart` component.

### Changes

**1. Rewrite `src/components/evan/dashboard/CompanyRevenueHero.tsx`**

Upgrade the existing component with:

- **Multi-layered chart**: Keep the existing ComposedChart (Area + Bar + Line) and add a forecast dashed line with confidence interval shading (upper/lower bound Area fills)
- **Forecasting**: Calculate projected revenue using linear trend from historical data + weighted pipeline value from `leads` table (same stage weights as the removed projection chart)
- **Additional timeframes**: Add QTD tab alongside MTD/YTD; keep the same `TimePeriod` type but extend it
- **Interactive legend**: Clickable legend items that toggle visibility of Revenue bars, Cumulative line, Forecast line, and Confidence band
- **Health status bar**: Color-coded indicator (on-track = blue/green, at-risk = orange, below-target = red) based on pace vs goal
- **KPI badges row**: Add a row of compact badges above the chart showing Growth Rate, Forecast Accuracy, Target Variance, and Revenue Gap
- **Enhanced tooltip**: Add Growth %, Target Variance, and Avg Deal Size to the existing tooltip
- **Goal pace reference line**: Keep existing dashed trend line but add a proper "Goal Pace" line showing where revenue should be to hit $1.5M
- **Milestone markers**: ReferenceLine markers at 25%, 50%, 75% of annual goal on the cumulative axis
- **Dark mode support**: All colors use CSS variables or have explicit dark mode variants
- **Responsive**: Legend items hide on mobile, chart height adapts, KPI badges wrap

**2. Update `src/pages/admin/EvansPage.tsx`**

- Remove the `RevenueProjectionChart` import and usage (line 52 and line 557)
- Update the `TimePeriod` type export to include `'qtd'`

**3. Delete `src/components/evan/dashboard/RevenueProjectionChart.tsx`**

- Remove the file entirely since its functionality is now merged into CompanyRevenueHero

### Stats Footer Enhancement

Expand the existing 4-stat footer to 6 stats:
1. Revenue (existing)
2. Avg per period (existing)
3. Best period (existing)
4. Deals Closed (existing)
5. **Forecast** -- projected end-of-period revenue
6. **Growth Rate** -- period-over-period growth %

### Data Flow

The component will make two queries:
1. `team_funded_deals` (existing) -- for actual revenue data
2. `leads` with pipeline stages (new) -- for weighted forecast calculation

### Technical Details

- Forecast calculation: Linear extrapolation from historical trend + weighted pipeline (discovery 10%, pre-qual 25%, docs 45%, underwriting 65%, approval 85%)
- Confidence band: Best case (1.2x forecast) and conservative (0.8x forecast) rendered as a translucent Area
- Legend state managed via `useState` object with boolean toggles per series
- Health status derived from: `current_pace = totalRevenue / elapsed_fraction_of_period` vs target
- All new features are additive -- the existing layout (left overview + right chart + footer) is preserved

### Files Summary

| Action | File |
|--------|------|
| Rewrite | `src/components/evan/dashboard/CompanyRevenueHero.tsx` |
| Edit | `src/pages/admin/EvansPage.tsx` (remove RevenueProjectionChart, update TimePeriod) |
| Delete | `src/components/evan/dashboard/RevenueProjectionChart.tsx` |

