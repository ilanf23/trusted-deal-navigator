

## Remove Hardcoded Data from AdamsPage.tsx

### What's Hardcoded Today

AdamsPage has **4 hardcoded data blocks** (lines 10-39):

1. **`metrics`** -- active deals, avg days, closings, conversion, lender relationships count, pending term sheets count
2. **`lenderActivity`** -- 5 static lender rows with deal counts, avg rate, status
3. **`termSheetsPending`** -- 4 static term sheet rows with client, lender, amount, status
4. **`operationalMetrics`** -- 4 static progress bars with value/target/progress

### Existing Database Sources

| Data Block | Source | Data Exists? |
|---|---|---|
| Metrics (active deals, conversion) | `v_team_performance` WHERE name = 'Adam' | Yes -- `{active_deals: 7, closings: 3, conversion: 30}` |
| Lender relationships count | `lender_programs` (COUNT DISTINCT lender_name) | Yes -- 883 programs |
| Pending term sheets count | `dashboard_deals` WHERE owner = 'Adam' AND stage is pre-close | Yes -- derivable |
| Lender activity | `dashboard_deals` aggregated by lender + `lender_programs` | Partially -- deals exist but no lender column on `dashboard_deals` |
| Term sheets pending | `dashboard_deals` WHERE stage is underwriting/negotiation | Yes -- real deal data |
| Operational metrics | No table exists | Needs `team_monthly_goals` (already created for Brad) |

### Plan

#### Step 1: Seed Adam's Operational Goals into `team_monthly_goals`

The table already exists from Brad's migration. Insert Adam's 4 operational metrics as goals:

- "Avg Days to Term Sheet" -- current: 14, target: 12
- "Lender Response Rate" -- current: 78, target: 85
- "Term Sheet Acceptance" -- current: 65, target: 70
- "Closing Efficiency" -- current: 28, target: 30

These become editable from the database going forward.

#### Step 2: Create `src/hooks/useAdamsDashboard.ts`

Follows the same pattern as `useBradsDashboard.ts`. Queries:

- **`v_team_performance`** filtered to Adam -- provides active_deals, avg_days, closings, conversion
- **`lender_programs`** COUNT of distinct lender_name -- provides lender relationships count
- **`dashboard_deals`** filtered to `owner_name = 'Adam'` with pre-close stages -- provides pending term sheets count + term sheet table rows
- **`dashboard_deals`** filtered to `owner_name = 'Adam'` grouped by stage -- provides lender activity approximation (since Adam's deals map to lender relationships)
- **`team_monthly_goals`** filtered to `team_member_name = 'Adam'` -- provides operational metrics with progress bars

Returns the same variable structure the JSX currently consumes:

```
{
  metrics: { activeDeals, avgDaysPerDeal, closingsLast30d, conversionRate, lenderRelationships, pendingTermSheets },
  lenderActivity: [{ lender, activeDeals, avgRate, status }],
  termSheetsPending: [{ client, lender, amount, status }],
  operationalMetrics: [{ metric, value, target, progress }],
  isLoading
}
```

For **lender activity**, since `dashboard_deals` doesn't have a lender column, we'll derive this from `lender_programs` -- aggregating distinct lenders by `call_status` (Active/Needs Attention/Dormant) with deal counts derived from `last_contact` recency.

For **term sheets pending**, we'll use `dashboard_deals` where Adam is owner and stage matches underwriting/negotiation stages (pre-close), showing deal_name as client, stage as status, and requested_amount as amount.

#### Step 3: Update AdamsPage.tsx

- Remove all hardcoded data (lines 10-39)
- Import and call `useAdamsDashboard()`
- Add loading skeleton state (same pattern as BradsPage)
- Keep all UI layout, styling, `getStatusColor`, and component hierarchy identical
- Map over hook data instead of static arrays

### What Does NOT Change

- UI layout, card grid, table structure, progress bars
- Component imports (AdminLayout, Card, Badge, Table, Progress)
- Styling classes and `getStatusColor` function
- Routing
- No other files modified

