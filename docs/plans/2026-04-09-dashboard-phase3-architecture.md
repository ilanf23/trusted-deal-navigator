# Phase 3: Architecture Improvements

## Overview

Remove the NudgesWidget auto-task-creation side effect (DB writes on every page load), debounce SuperAdmin realtime subscriptions, scope TopActions data to only the current user's leads, and lazy-load below-the-fold widgets to defer their queries.

- **Parent plan:** [Master Plan](./2026-04-09-dashboard-performance-fix.md)
- **Depends on:** [Phase 1](./2026-04-09-dashboard-phase1-caching.md) + [Phase 2](./2026-04-09-dashboard-phase2-errors.md) (completed)
- **Risk:** Moderate — NudgesWidget behavior change affects user workflow (auto-created tasks), lazy loading may cause layout shift
- **Impact:** Side effects removed, queries scoped to user, below-fold widgets lazy-loaded (~8 queries on initial paint instead of ~12)

## Context

- **Files involved:**
  - `src/components/employee/dashboard/NudgesWidget.tsx` — replace auto-insert useEffect with explicit button
  - `src/hooks/useSuperAdminDashboard.ts` — debounce realtime subscription handlers
  - `src/components/employee/dashboard/TopActions.tsx` — scope comms query to user's leads
  - `src/pages/admin/Dashboard.tsx` — lazy-load NudgesWidget + TopActions with Suspense
- **Related patterns:** Existing `useMutation` pattern used throughout the codebase for explicit user-initiated writes
- **Dependencies:** Phase 1 + Phase 2 completed (caching, dedup, error boundaries all in place)

## Development Approach

- **Testing approach:** Manual verification (no automated tests in this project)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: update this plan file when scope changes during implementation**
- Run `npm run build` and `npm run lint` after each task
- Phase 3 changes user-facing behavior (NudgesWidget) — pay extra attention to functional correctness

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Remove NudgesWidget auto-insert side effect

**File:** `src/components/employee/dashboard/NudgesWidget.tsx`

The `useEffect` at lines 94-143 auto-creates tasks on every dashboard mount. Replace with an explicit "Create All Tasks" button using `useMutation`.

- [ ] Remove the entire `useEffect` block for `createFollowUpTasks` (lines 94-143)
- [ ] Remove `tasksCreatedRef` ref (line 50)
- [ ] Remove `useRef` from imports if no longer needed (check if `useState` still needed)
- [ ] Add `useMutation` for explicit task creation with same logic as removed useEffect:
  - `mutationFn`: loop over `nudgeLeads`, insert task per lead, mark lead as nudged
  - `onSuccess`: invalidate `['tasks']` and `['dashboard-nudges']`, show success toast
  - `onError`: show error toast
- [ ] Add `CheckCircle2` to the lucide-react imports
- [ ] Add "Create All Tasks" button to widget header (next to the Gmail link):
  ```tsx
  <Button
    variant="outline"
    size="sm"
    className="gap-1"
    onClick={() => createTasksMutation.mutate()}
    disabled={createTasksMutation.isPending || nudgeLeads.length === 0}
  >
    {createTasksMutation.isPending
      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
      : <CheckCircle2 className="h-3.5 w-3.5" />
    }
    Create All Tasks
  </Button>
  ```
- [ ] Run `npm run build` — must pass before next task

### Task 2: Debounce SuperAdmin realtime subscriptions

**File:** `src/hooks/useSuperAdminDashboard.ts`

The realtime subscription (lines 134-155) refetches queries on every single row change. Multiple rapid changes cause thundering herd of refetches.

- [ ] Import `useRef` from React (add to existing import)
- [ ] Add debounce ref before the useEffect:
  ```typescript
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  ```
- [ ] Replace realtime subscription useEffect (lines 134-155) with debounced version:
  - Create `debouncedRefetch` helper that clears previous timeout and sets 2-second delay
  - Each subscription handler calls `debouncedRefetch` instead of direct `.refetch()`
  - Cleanup function clears timeout and removes channel
- [ ] Run `npm run build` — must pass before next task

### Task 3: Scope TopActions communications query to user's leads

**File:** `src/components/employee/dashboard/TopActions.tsx`

The `lead-communications` query (lines 95-108) fetches last 100 communications globally with no team member filter.

- [ ] Extract `leadIds` from `leadsData`:
  ```typescript
  const leadIds = leadsData?.map(l => l.id) || [];
  ```
- [ ] Replace communications query with scoped version:
  ```typescript
  const { data: communications } = useQuery({
    queryKey: ['lead-communications', evanId, leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('communications')
        .select('lead_id, created_at, communication_type, direction')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!evanId && leadIds.length > 0,
  });
  ```
- [ ] Run `npm run build` — must pass before next task

### Task 4: Lazy-load below-the-fold widgets

**File:** `src/pages/admin/Dashboard.tsx`

`NudgesWidget` and `TopActions` are below the revenue chart and not visible on initial page load. Lazy-loading defers their queries until the component renders.

- [ ] Import `lazy` and `Suspense` from React (add to existing import at line 1)
- [ ] Replace static imports with lazy:
  ```typescript
  const NudgesWidget = lazy(() => import('@/components/employee/dashboard/NudgesWidget'));
  const TopActions = lazy(() => import('@/components/employee/dashboard/TopActions'));
  ```
- [ ] Wrap `<NudgesWidget>` with `Suspense` (inside existing `DashboardErrorBoundary` from Phase 2):
  ```tsx
  <DashboardErrorBoundary name="Nudges">
    <Suspense fallback={
      <Card><CardContent className="py-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    }>
      <NudgesWidget evanId={evanId} />
    </Suspense>
  </DashboardErrorBoundary>
  ```
- [ ] Wrap `<TopActions>` with same `Suspense` pattern (inside its `DashboardErrorBoundary`)
- [ ] Run `npm run build` — must pass before next task

### Task 5: Final verification

- [ ] Run `npm run build` — no TypeScript errors
- [ ] Run `npm run lint` — no new lint warnings

## Post-Completion

**Manual verification** (requires running the app in browser):

- Open Dashboard — NudgesWidget should NOT auto-create tasks on load
- Click "Create All Tasks" button in NudgesWidget — tasks should be created, toast shown
- Check Network tab — below-the-fold widget chunk files should load after initial paint
- TopActions should only show communications for the current user's assigned leads (not all 100 global comms)
- SuperAdmin dashboard — rapidly change data and verify refetches are debounced (only 1 refetch after changes stop)
- Scroll down quickly to NudgesWidget/TopActions — verify Suspense fallback (spinner) shows briefly then content loads
- Verify total initial query count is ~8 (down from ~15)
