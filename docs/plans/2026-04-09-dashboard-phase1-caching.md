# Phase 1: Fix Caching & Deduplicate Queries

## Overview

Stop the 4 queries in `useDashboardData.ts` from overriding the global 2-minute cache, eliminate 2 redundant duplicate queries, and reduce retry noise. This is the highest-impact, lowest-risk phase — only changes query config and removes duplicates.

- **Parent plan:** [Master Plan](./2026-04-09-dashboard-performance-fix.md)
- **Risk:** Very low — data derivation is identical, only query config changes
- **Impact:** ~50-60% reduction in initial queries and console noise

## Context

- **Files involved:**
  - `src/components/admin/dashboard/useDashboardData.ts` — main hook with 9 queries, 4 with cache-busting
  - `src/components/employee/dashboard/RevenueChart.tsx` — separate query for all funded deals
- **Related patterns:** Global TanStack Query config at `App.tsx:96-103` sets `staleTime: 1000 * 60 * 2` (2 min), `refetchOnWindowFocus: false`
- **Dependencies:** None — this phase is standalone

## Development Approach

- **Testing approach:** Manual verification (no automated tests in this project)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: update this plan file when scope changes during implementation**
- Run `npm run build` and `npm run lint` after each task
- Maintain backward compatibility — all dashboard widgets must render identically

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Remove aggressive cache-busting from useDashboardData

**File:** `src/components/admin/dashboard/useDashboardData.ts`

The global config sets `staleTime: 2min`. These 4 queries override it with `staleTime: 0` and `refetchOnMount: 'always'`, causing every mount to re-fire all queries.

- [ ] Remove `staleTime: 0` and `refetchOnMount: 'always' as const` from `leadsQuery` (lines 41-42)
- [ ] Remove `staleTime: 0` and `refetchOnMount: 'always' as const` from `pipelineQuery` (lines 56-57)
- [ ] Remove `staleTime: 0` and `refetchOnMount: 'always' as const` from `fundedQuery` (lines 72-73)
- [ ] Remove `staleTime: 0` and `refetchOnMount: 'always' as const` from `companyDealsQuery` (lines 91-92)
- [ ] Run `npm run build` — must pass before next task

### Task 2: Reduce retry count on all dashboard queries

**File:** `src/components/admin/dashboard/useDashboardData.ts`

TanStack Query defaults to 3 retries. With 9 queries, a Supabase outage generates 36 error lines (9 x 4 attempts). Reducing to 1 retry cuts this to 18.

- [ ] Add `retry: 1` to `leadsQuery` options
- [ ] Add `retry: 1` to `pipelineQuery` options
- [ ] Add `retry: 1` to `fundedQuery` options
- [ ] Add `retry: 1` to `touchpointsQuery` options
- [ ] Add `retry: 1` to `tasksQuery` options
- [ ] Add `retry: 1` to `scorecardLeadsQuery` options
- [ ] Add `retry: 1` to `lenderQuery` options
- [ ] Run `npm run build` — must pass before next task

### Task 3: Consolidate duplicate funded-deals queries

**File:** `src/components/admin/dashboard/useDashboardData.ts`

Two queries fetch `potential WHERE status='funded'`:
- `fundedQuery` (lines 61-74): filtered by `periodStart` (MTD or YTD)
- `companyDealsQuery` (lines 77-93): always from start of year

When `timePeriod === 'ytd'`, both fetch the same range. Solution: make `fundedQuery` always fetch YTD, derive period subsets client-side.

- [ ] Modify `fundedQuery` to always fetch from `startOfYear(now)`, include `name` in select, remove `timePeriod` from queryKey:
  ```typescript
  const fundedQuery = useQuery({
    queryKey: ['admin-funded-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, name, converted_at, lead_responses(loan_amount)')
        .eq('status', 'funded')
        .gte('converted_at', startOfYear(now).toISOString());
      if (error) throw error;
      return data;
    },
    retry: 1,
  });
  ```
- [ ] Remove `companyDealsQuery` entirely (lines 77-93)
- [ ] Update `companyRevenueData` useMemo to derive from `fundedQuery.data`:
  ```typescript
  const companyRevenueData = useMemo(() => {
    const allFunded = fundedQuery.data || [];
    const ytd = allFunded.reduce(
      (sum, d) => sum + (d.lead_responses?.[0]?.loan_amount || 0) * 0.01, 0
    );
    const monthStart = startOfMonth(now);
    const mtd = allFunded
      .filter(d => d.converted_at && new Date(d.converted_at) >= monthStart)
      .reduce((sum, d) => sum + (d.lead_responses?.[0]?.loan_amount || 0) * 0.01, 0);
    return { ytd, mtd };
  }, [fundedQuery.data]);
  ```
- [ ] Update `confidence` useMemo to use `fundedQuery.data` instead of `companyDealsQuery.data`:
  ```typescript
  const deals = (fundedQuery.data || []).map(d => ({
    fee_earned: (d.lead_responses?.[0]?.loan_amount || 0) * 0.01,
    funded_at: d.converted_at,
  }));
  ```
- [ ] Remove all remaining references to `companyDealsQuery` (isLoading, isFetching, return object)
- [ ] Run `npm run build` — must pass before next task

### Task 4: Consolidate duplicate communications queries

**File:** `src/components/admin/dashboard/useDashboardData.ts`

Two queries fetch `communications` for the same week:
- `touchpointsQuery` (lines 96-108): includes `duration_seconds`
- `scorecardCommsQuery` (lines 126-137): subset of touchpoints columns

The touchpoints query is a strict superset.

- [ ] Remove `scorecardCommsQuery` entirely (lines 126-137)
- [ ] Update `scorecardData` useMemo to use `touchpointsQuery.data` instead of `scorecardCommsQuery.data`
- [ ] Update `scorecardLoading` in return to use `touchpointsQuery.isLoading`
- [ ] Run `npm run build` — must pass before next task

### Task 5: Add staleTime to RevenueChart query

**File:** `src/components/employee/dashboard/RevenueChart.tsx`

The `revenue-chart` query fetches ALL funded deals with no date filter. Chart data changes infrequently — a 5-minute cache is appropriate.

- [ ] Add `staleTime: 1000 * 60 * 5` and `retry: 1` to the useQuery options (line 47)
- [ ] Run `npm run build` — must pass before next task

### Task 6: Verify Phase 1

- [ ] Run `npm run build` — no TypeScript errors
- [ ] Run `npm run lint` — no new lint warnings

## Post-Completion

**Manual verification** (requires running the app in browser):

- Open Dashboard, check Network tab — should see ~12 Supabase requests instead of ~15
- Navigate away and back within 2 min — should see 0 new Supabase requests (served from cache)
- Check console — error count should be significantly reduced (fewer retries)
- Verify all dashboard widgets render with identical data (KPIs, charts, scorecard)
- Verify MTD/YTD toggle still filters correctly (funded deals, revenue, confidence score)
