# Phase 2: Error Handling

## Overview

Add error boundaries around each dashboard widget so a single failing query doesn't crash the entire page. Add inline "Failed to load — Try again" states to individual widgets. Remove unsafe `as any` casts from SuperAdmin dashboard.

- **Parent plan:** [Master Plan](./2026-04-09-dashboard-performance-fix.md)
- **Depends on:** [Phase 1](./2026-04-09-dashboard-phase1-caching.md) (completed)
- **Risk:** Low — error boundaries are additive, type cast removal may surface fixable mismatches
- **Impact:** Zero unhandled console errors, graceful fallback UI with retry

## Context

- **Files involved:**
  - `src/components/shared/DashboardErrorBoundary.tsx` (new) — reusable error boundary
  - `src/pages/admin/Dashboard.tsx` — wrap widgets with boundaries
  - `src/components/employee/dashboard/RevenueChart.tsx` — add inline error state
  - `src/components/employee/dashboard/TopActions.tsx` — add inline error state
  - `src/components/employee/dashboard/NudgesWidget.tsx` — add inline error state
  - `src/hooks/useSuperAdminDashboard.ts` — remove `as any` casts, add retry
- **Related patterns:**
  - `PanelErrorBoundary` in `src/components/admin/splitview/SplitViewPanel.tsx:13-51` — class component with reset on prop change
  - `UWErrorBoundary` in `src/pages/admin/Underwriting.tsx:1717-1725` — minimal class component
- **Dependencies:** Phase 1 completed (caching + dedup fixes applied)

## Development Approach

- **Testing approach:** Manual verification (no automated tests in this project)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: update this plan file when scope changes during implementation**
- Run `npm run build` and `npm run lint` after each task

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Create DashboardErrorBoundary component

**File (new):** `src/components/shared/DashboardErrorBoundary.tsx`

Follow the `PanelErrorBoundary` pattern. Class component (React error boundaries require class components) that catches render errors and shows a compact fallback card with retry.

- [ ] Create `src/components/shared/DashboardErrorBoundary.tsx` with:
  - Props: `{ children: ReactNode; name: string }`
  - State: `{ hasError: boolean; error: Error | null }`
  - `getDerivedStateFromError` — sets error state
  - `componentDidCatch` — logs with widget name: `[Dashboard] "${name}" widget error:`
  - Fallback render: `Card` with `AlertTriangle` icon, `"{name} couldn't load"` text, error message, "Try again" `Button`
  - "Try again" resets state: `this.setState({ hasError: false, error: null })`
- [ ] Run `npm run build` — must pass before next task

### Task 2: Wrap dashboard widgets with error boundaries

**File:** `src/pages/admin/Dashboard.tsx`

- [ ] Import `DashboardErrorBoundary` from `@/components/shared/DashboardErrorBoundary`
- [ ] Wrap `<RevenueChart>` (line 356) with `<DashboardErrorBoundary name="Revenue Chart">`
- [ ] Wrap `<NudgesWidget>` (line 359) with `<DashboardErrorBoundary name="Nudges">`
- [ ] Wrap `<TopActions>` (line 362) with `<DashboardErrorBoundary name="Top Actions">`
- [ ] Wrap Today's Schedule card (lines 365-449) with `<DashboardErrorBoundary name="Schedule">`
- [ ] Wrap Hot Deals card (lines 451-497) with `<DashboardErrorBoundary name="Hot Deals">`
- [ ] Run `npm run build` — must pass before next task

### Task 3: Add inline error state to RevenueChart

**File:** `src/components/employee/dashboard/RevenueChart.tsx`

- [ ] Destructure `isError` and `refetch` from the useQuery call (line 47)
- [ ] Import `AlertCircle` from lucide-react and `Button` from `@/components/ui/button`
- [ ] Add early return for error state (before the chart filters/render):
  ```typescript
  if (isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Failed to load revenue data</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  ```
- [ ] Run `npm run build` — must pass before next task

### Task 4: Add inline error state to TopActions

**File:** `src/components/employee/dashboard/TopActions.tsx`

- [ ] Destructure `isError` and `refetch` from the leads query (line 65)
- [ ] Add error case in the render section (after loading spinner, before the table/empty state):
  ```typescript
  {isError ? (
    <div className="text-center py-12 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
      <p className="text-sm">Failed to load actions</p>
      <button onClick={() => refetch()} className="text-xs text-primary hover:underline mt-1">
        Try again
      </button>
    </div>
  ) : actions.length === 0 ? (
    // existing empty state...
  ```
  Note: `AlertTriangle` is already imported.
- [ ] Run `npm run build` — must pass before next task

### Task 5: Add inline error state to NudgesWidget

**File:** `src/components/employee/dashboard/NudgesWidget.tsx`

- [ ] Destructure `isError` and `refetch` from the query (line 65)
- [ ] Add early return for error state (before `!isLoading && nudgeLeads.length === 0` check at line 207):
  ```typescript
  if (isError) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="py-8 text-center">
          <Bell className="h-6 w-6 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Failed to load nudges</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  ```
  Note: `Bell` and `Button` are already imported.
- [ ] Run `npm run build` — must pass before next task

### Task 6: Remove (supabase as any) casts in SuperAdmin dashboard

**File:** `src/hooks/useSuperAdminDashboard.ts`

All 5 queries use `(supabase as any)` (lines 76, 89, 99, 110, 122), but types exist in `src/integrations/supabase/types.ts`. The casts hide potential type mismatches.

- [ ] Replace `(supabase as any).from('revenue_targets')` with `supabase.from('revenue_targets')` (line 76)
- [ ] Replace `(supabase as any).from('v_pipeline_metrics')` with `supabase.from('v_pipeline_metrics')` (line 89)
- [ ] Replace `(supabase as any).from('v_team_performance')` with `supabase.from('v_team_performance')` (line 99)
- [ ] Replace `(supabase as any).from('v_referral_analytics')` with `supabase.from('v_referral_analytics')` (line 110)
- [ ] Replace `(supabase as any).from('dashboard_weekly_scorecard')` with `supabase.from('dashboard_weekly_scorecard')` (line 122)
- [ ] Fix any TypeScript errors surfaced by removing casts (likely: update manual interfaces to match auto-generated types)
- [ ] Add `retry: 1` to all 5 queries to match Phase 1 convention
- [ ] Run `npm run build` — must pass before next task

### Task 7: Final verification

- [ ] Run `npm run build` — no TypeScript errors
- [ ] Run `npm run lint` — no new lint warnings

## Post-Completion

**Manual verification** (requires running the app in browser):

- Simulate a failing query (temporarily change a table name in code) — verify error boundary shows "couldn't load" card, not blank page
- Click "Try again" on error fallback — verify query retries and widget recovers
- Verify SuperAdmin dashboard (`/superadmin/dashboard`) still works after removing `as any` casts
- Verify console shows structured error logs like `[Dashboard] "Revenue Chart" widget error:` instead of raw unhandled errors
- Verify that when one widget fails, other widgets continue to render normally
