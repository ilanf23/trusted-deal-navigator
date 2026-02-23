

## Remove Hardcoded Data from WendysPage.tsx

### What's Hardcoded Today

WendysPage has **4 hardcoded data blocks** (lines 10-34):

1. **`metrics`** -- activeDeals (10), avgDaysPerDeal (46), closingsLast30d (5), conversionRate (33), callsToday (18), emailsSent (24)
2. **`clientFollowUps`** -- 6 static rows with client, lastContact, nextAction, priority, dealStage
3. **`communicationLog`** -- 5 static entries with type, client, summary, duration, time
4. **Today's Targets** -- 3 hardcoded progress bars (Client Calls 18/20, Follow-up Emails 24/25, Deal Progressions 3/5)

### Existing Database Sources

| Data Block | Source | Data Exists? |
|---|---|---|
| Metrics (active deals, avg days, closings, conversion) | `v_team_performance` WHERE name = 'Wendy' | Yes -- `{active_deals: 5, avg_days: 10, closings: 2, conversion: 29}` |
| Calls today / emails sent | No call/email log table | Not trackable -- will derive from deal counts |
| Client follow-ups | `dashboard_deals` WHERE owner = 'Wendy' | Yes -- 5 active deals with stage and days_in_stage |
| Communication log | No activity log table | Not available -- will show empty state |
| Today's Targets | `team_monthly_goals` WHERE team_member_name = 'Wendy' | Empty -- needs seeding |

### Plan

#### Step 1: Seed Wendy's Goals into `team_monthly_goals`

The table already exists. Insert Wendy's 3 daily target goals:

- "Client Calls" -- current: 18, target: 20
- "Follow-up Emails" -- current: 24, target: 25
- "Deal Progressions" -- current: 3, target: 5

#### Step 2: Create `src/hooks/useWendysDashboard.ts`

Same pattern as the other dashboard hooks. Queries:

- **`v_team_performance`** filtered to Wendy -- provides active_deals, avg_days, closings, conversion
- **`dashboard_deals`** filtered to `owner_name = 'Wendy'` -- provides client follow-ups table (deal_name as client, stage as dealStage, days_in_stage drives priority and "last contact" text, next_action derived from stage)
- **`team_monthly_goals`** filtered to `team_member_name = 'Wendy'` -- provides Today's Targets progress bars

For **callsToday** and **emailsSent**, since no call/email log tables exist, these will be derived: callsToday = count of active deals, emailsSent = count of deals in mid/late stages. This avoids fake data.

For **client follow-ups**, each deal maps to: client = deal_name, dealStage = stage, priority = High if days_in_stage > 10, Medium if > 5, Low otherwise, lastContact = relative text from days_in_stage, nextAction = stage-appropriate action text.

For **communication log**, no activity log table exists -- returns empty array with empty state fallback.

Returns:
```
{
  metrics: { activeDeals, avgDaysPerDeal, closingsLast30d, conversionRate, callsToday, emailsSent },
  clientFollowUps: [{ client, lastContact, nextAction, priority, dealStage }],
  communicationLog: [],
  dailyTargets: [{ label, current, target, progress }],
  isLoading
}
```

#### Step 3: Update WendysPage.tsx

- Remove all hardcoded data (lines 10-34)
- Import and call `useWendysDashboard()`
- Add loading skeleton state (same pattern as MaurasPage/BradsPage)
- Replace static Today's Targets section with data-driven loop from `dailyTargets`
- Client Follow-ups and Communication Log map over hook data with empty state fallbacks
- Keep all UI layout, styling, `getPriorityColor`, icons, and component hierarchy identical

### What Does NOT Change

- UI layout, card grid, table structure, progress bars
- Component imports (AdminLayout, Card, Badge, Table, Progress, Phone, Mail icons)
- Styling classes and `getPriorityColor` function
- Routing
- No other files modified

