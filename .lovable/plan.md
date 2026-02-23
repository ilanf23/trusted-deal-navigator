

## Remove Hardcoded Data from BradsPage.tsx

### What's Hardcoded Today

BradsPage has **5 hardcoded data blocks** (lines 10-38, 207-234):

1. **`metrics`** -- active deals, avg days, closings, conversion, pipeline value, projected fees
2. **`highValueDeals`** -- 5 static deal rows
3. **`upcomingMeetings`** -- 4 static meeting entries
4. **`referralPartners`** -- 3 static partner rows
5. **Monthly Goals** -- 3 hardcoded progress bars with static values

### Existing Database Tables That Already Have Brad's Data

| Data Block | Source Table/View | Brad's Data Exists? |
|---|---|---|
| Metrics (active deals, conversion, etc.) | `v_team_performance` | Yes -- `{active_deals: 9, closings: 3, conversion: 25}` |
| Pipeline value / projected fees | `dashboard_deals` (aggregate) | Yes -- 9 deals with amounts |
| High-value deals | `dashboard_deals WHERE owner_name = 'Brad'` | Yes -- real deal data |
| Upcoming meetings | `evan_appointments WHERE team_member_name = 'brad'` | Empty -- needs to be populated |
| Referral partners | `dashboard_referral_sources` | Yes -- shared table |
| Monthly goals | No table exists | Needs new table |

### Plan

#### Step 1: Create `team_monthly_goals` Table (Migration)

New table for the monthly goals section:

```sql
CREATE TABLE team_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_name text NOT NULL,
  goal_label text NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  target_value integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE team_monthly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage team monthly goals"
  ON team_monthly_goals FOR ALL
  USING (has_role(auth.uid(), 'admin'));
```

Seed Brad's 3 goals into the table.

#### Step 2: Create `useBradsDashboard` Hook

New file: `src/hooks/useBradsDashboard.ts`

Queries:
- `v_team_performance` filtered to Brad -- provides active_deals, avg_days, closings, conversion
- `dashboard_deals` filtered to `owner_name = 'Brad'`, ordered by `requested_amount DESC`, limit 10 -- provides high-value deals with real stage, amount, fees, days
- Aggregate `dashboard_deals` for Brad -- pipeline value (sum of requested_amount) and projected fees (sum of weighted_fees)
- `evan_appointments` filtered to `team_member_name = 'brad'` and `start_time >= now()` -- upcoming meetings
- `dashboard_referral_sources` ordered by `total_revenue DESC`, limit 5 -- top referral partners
- `team_monthly_goals` filtered to `team_member_name = 'Brad'` -- monthly goals

Returns the same variable structure the JSX currently consumes.

#### Step 3: Update BradsPage.tsx

- Remove all hardcoded data (lines 10-38)
- Import and call `useBradsDashboard()`
- Add loading skeleton when `isLoading`
- Replace static monthly goals section with data-driven loop
- Keep all UI layout, styling, component hierarchy, and formatting logic identical

### What Does NOT Change

- UI layout, card grid, table structure, progress bars
- Component imports (AdminLayout, Card, Badge, Table, etc.)
- Styling classes and color logic (`getProbabilityColor`)
- Routing
- No other files modified

### Technical Details

The hook will format numbers the same way the current hardcoded values display them (e.g., `$15.2M`, `$152K`) so the JSX remains unchanged. The `evan_appointments` table already supports `team_member_name` for multi-user filtering.

