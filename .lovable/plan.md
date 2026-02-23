

## Remove Hardcoded Data from MaurasPage.tsx

### What's Hardcoded Today

MaurasPage has **4 hardcoded data blocks** (lines 10-33, 194-214):

1. **`metrics`** -- activeDeals (6), avgDaysPerDeal (36), closingsLast30d (5), conversionRate (45), docsProcessedToday (12), pendingReview (8)
2. **`processingQueue`** -- 6 static rows with client, document type, status, priority, daysInQueue
3. **`recentActivity`** -- 4 static activity entries with action, client, document, time
4. **Today's Progress** -- 3 hardcoded progress bars (Documents Processed 12/15, Packages Completed 3/4, Review Queue Cleared 60%)

### Existing Database Sources

| Data Block | Source | Data Exists? |
|---|---|---|
| Metrics (active deals, avg days, closings, conversion) | `v_team_performance` WHERE name = 'Maura' | Yes -- `{active_deals: 6, avg_days: 10, closings: 3, conversion: 33}` |
| Docs processed today / pending review | Derivable from `dashboard_deals` stage counts | Partially -- can derive from deal stages |
| Processing queue | `dashboard_deals` WHERE owner = 'Maura' AND stage is not Closed | Yes -- 6 active deals with stage and days_in_stage |
| Recent activity | No activity log table | Not available -- will show empty state |
| Today's Progress | No table exists | Needs `team_monthly_goals` (already created) |

### Plan

#### Step 1: Seed Maura's Goals into `team_monthly_goals`

The table already exists. Insert Maura's 3 daily progress goals:

- "Documents Processed" -- current: 12, target: 15
- "Packages Completed" -- current: 3, target: 4
- "Review Queue Cleared" -- current: 60, target: 100

These become editable from the database going forward.

#### Step 2: Create `src/hooks/useMaurasDashboard.ts`

Follows the same pattern as `useBradsDashboard.ts` and `useAdamsDashboard.ts`. Queries:

- **`v_team_performance`** filtered to Maura -- provides active_deals, avg_days, closings, conversion
- **`dashboard_deals`** filtered to `owner_name = 'Maura'` and stage not Closed -- provides processing queue (deal_name as client, stage as document type proxy, days_in_stage). Also provides docsProcessedToday (count of deals in active stages) and pendingReview (count of deals in early stages)
- **`team_monthly_goals`** filtered to `team_member_name = 'Maura'` -- provides Today's Progress section

For **processing queue**, we map the real deals: deal_name becomes client, stage becomes type, days_in_stage drives priority (High if > 10 days, Medium if > 5, Low otherwise), and status is derived from stage position (early = Pending, mid = In Review, late = Complete).

For **recent activity**, since there is no activity log table in the database, the section will show an empty state message: "No recent activity." This avoids hardcoded fake data.

Returns:
```
{
  metrics: { activeDeals, avgDaysPerDeal, closingsLast30d, conversionRate, docsProcessedToday, pendingReview },
  processingQueue: [{ client, type, status, priority, daysInQueue }],
  recentActivity: [],
  dailyProgress: [{ label, current, target, progress }],
  isLoading
}
```

#### Step 3: Update MaurasPage.tsx

- Remove all hardcoded data (lines 10-33, 194-214)
- Import and call `useMaurasDashboard()`
- Add loading skeleton state (same pattern as AdamsPage/BradsPage)
- Replace static Today's Progress section with data-driven loop from `dailyProgress`
- Recent Activity section maps over hook data with empty state fallback
- Keep all UI layout, styling, `getPriorityColor`, `getStatusColor`, and component hierarchy identical

### What Does NOT Change

- UI layout, card grid, table structure, progress bars
- Component imports (AdminLayout, Card, Badge, Table, Progress)
- Styling classes, `getPriorityColor` and `getStatusColor` functions
- Routing
- No other files modified

