# Phase 3: Architecture Improvements (Refined)

## Overview

Remove the NudgesWidget auto-task-creation side effect (DB writes on every page load), debounce SuperAdmin realtime subscriptions, verify/scope below-fold widget queries to only the current user's data, and lazy-load below-the-fold widgets to defer their queries.

- **Parent plan:** [Master Plan](./2026-04-09-dashboard-performance-fix.md)
- **Depends on:** [Phase 1](./2026-04-09-dashboard-phase1-caching.md) + [Phase 2](./2026-04-09-dashboard-phase2-errors.md) — re-verify before starting Phase 3 (DashboardErrorBoundary may not yet be in place)
- **Risk:** Moderate — NudgesWidget behavior change affects user workflow (auto-created tasks), lazy loading may cause layout shift
- **Impact:** Side effects removed, queries scoped to user, below-fold widgets lazy-loaded (~8 queries on initial paint instead of ~12)

## Context

- **Files involved:**
  - `src/components/employee/dashboard/NudgesWidget.tsx` — replace auto-insert useEffect with explicit button mutation
  - `src/hooks/useSuperAdminDashboard.ts` — debounce realtime subscription handlers (lines 357-378)
  - `src/components/employee/dashboard/TopActions.tsx` — verify scoping (current query at lines 84-107 already filters by `evanId`)
  - `src/pages/admin/Dashboard.tsx` — lazy-load NudgesWidget + TopActions with Suspense (current usage at lines 322-323)
  - `src/components/shared/DashboardErrorBoundary.tsx` — required by Phase 2; verify presence before lazy wrapping
- **Related patterns:**
  - `useMutation` pattern with `onSuccess` invalidation (see `src/hooks/useTasksData.ts`)
  - Lazy loading with Suspense (search src for `React.lazy`)
  - Existing class-based error boundary pattern (`PanelErrorBoundary` at `src/components/admin/splitview/SplitViewPanel.tsx:13-51`)
- **Dependencies:** Phase 1 + Phase 2 should be verified completed before starting

## Development Approach

- **Testing approach:** Regular (manual verification — no automated test suite in this project; Playwright installed but inactive)
- Complete each task fully before moving to the next
- Run `npm run build` after each task and `npm run lint` before final completion
- Phase 3 changes user-facing behavior (NudgesWidget auto-tasks) — pay extra attention to functional correctness

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 0: Pre-flight verification

**Files:** read-only inspection

- [x] Confirm `src/components/shared/DashboardErrorBoundary.tsx` exists; if missing, complete Phase 2 Task 1 first
- [x] Confirm Dashboard.tsx widgets are wrapped with `DashboardErrorBoundary`; if not, complete Phase 2 Task 2 first
- [x] Grep for `lead-communications` query keys to confirm whether obsolete TopActions query exists
- [x] Document findings as inline notes (➕ prefix) in this plan

➕ **Finding 1 (Phase 2 prerequisite gap):** `src/components/shared/DashboardErrorBoundary.tsx` does NOT exist. Only `src/components/shared/DataTable.tsx` is present in that directory. Phase 2 Task 1 has not been completed.

➕ **Finding 2 (Phase 2 prerequisite gap):** `src/pages/admin/Dashboard.tsx` does NOT wrap `<NudgesWidget>` or `<TopActions>` (lines 322-323) with any error boundary. Phase 2 Task 2 has not been completed.

➕ **Finding 3 (Task 3 scope):** A grep for `lead-communications` returns only one match: `src/components/admin/LeadDetailDialog.tsx:552`. There is NO stale `lead-communications` query in `TopActions.tsx`. Task 3 will be N/A — current `top-actions-overdue` query is already scoped via `.eq('team_member_id', evanId!)`.

➕ **Action required (Task 4 impact):** Because `DashboardErrorBoundary` is missing, Task 4's conditional "nest Suspense inside DashboardErrorBoundary" step will be skipped; Suspense wrapping alone will be applied. Phase 2 should be scheduled separately.

**Acceptance:** All Phase 2 prerequisites verified or scheduled; Task 3 scope confirmed.

### Task 1: Remove NudgesWidget auto-insert side effect

**File:** `src/components/employee/dashboard/NudgesWidget.tsx`

Subtasks:

- [x] Remove `tasksCreatedRef` `useRef` declaration (line 50)
- [x] Remove the entire auto-insert `useEffect` block (lines 94-143) including the `createFollowUpTasks` async function
- [x] Remove `useRef` from React imports (line 12) — keep `useEffect` / `useState` if still used elsewhere
- [x] Add `CheckCircle2` to lucide-react imports (line 7)
- [x] Add `createTasksMutation` using `useMutation`:
  - `mutationFn` iterates `nudgeLeads`, inserts task into `tasks` table per lead with: title `7-Day Follow Up: ${lead.name}`, status `'todo'`, priority `'high'`, `lead_id`, `team_member_id` from `teamMember.id`, group_name `'To Do'`, source `'nudge'`, task_type `'email'`, due_date today
  - After successful insert per lead, update `potential.initial_nudge_created_at` for that lead
  - `onSuccess`: `queryClient.invalidateQueries({ queryKey: ['tasks'] })` and `queryClient.invalidateQueries({ queryKey: ['dashboard-nudges'] })`; show `toast.success('Created N follow-up tasks')`
  - `onError`: `toast.error('Failed to create tasks: ' + err.message)`
- [x] Add "Create All Tasks" Button next to the existing Gmail link in CardHeader (around lines 235-240):
  - `variant="outline"`, `size="sm"`, `className="gap-1"`
  - `onClick` triggers `createTasksMutation.mutate()`
  - `disabled` when `createTasksMutation.isPending || nudgeLeads.length === 0`
  - Show `Loader2` spinner when pending, otherwise `CheckCircle2` icon
- [x] Run `npm run build` — must pass with no TypeScript errors

**Acceptance:**

- No DB writes occur on dashboard page load (verify with Network tab)
- Clicking the new button creates one task per lead and updates `initial_nudge_created_at`
- Toast feedback appears on success and error
- Widget still renders existing nudge list and "Create Draft" buttons unchanged

### Task 2: Debounce SuperAdmin realtime subscriptions

**File:** `src/hooks/useSuperAdminDashboard.ts`

Subtasks:

- [ ] Add `useRef` to existing React import on line 2: `import { useEffect, useMemo, useRef } from 'react'`
- [ ] Inside `useSuperAdminDashboard` (after `prevRange = ...` on line 147), add: `const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)`
- [ ] Add `const pendingRefetchesRef = useRef<Set<() => void>>(new Set())` to coalesce all refetch callbacks during the debounce window
- [ ] Replace realtime subscription useEffect (lines 357-378) with debounced version:
  - Define inline helper `scheduleRefetch(refetchFn)`: adds fn to `pendingRefetchesRef`, clears existing `debounceRef` timeout, sets new 2000ms `setTimeout` that runs all pending refetches and clears the set
  - Each `.on('postgres_changes', ...)` handler calls `scheduleRefetch` with the appropriate refetch function (e.g., `() => pipelineQuery.refetch()`)
  - Cleanup function: `if (debounceRef.current) clearTimeout(debounceRef.current); supabase.removeChannel(channel);`
- [ ] Keep `// eslint-disable-line react-hooks/exhaustive-deps` comment
- [ ] Run `npm run build` — must pass

**Acceptance:**

- Manually triggering 3+ rapid changes to `dashboard_deals` results in exactly one refetch (verified via React Query Devtools or Network tab)
- Single change still refetches after ~2s delay
- Cleanup runs on unmount without leaking timers (no console warnings)

### Task 3: Verify and scope TopActions query (revised)

**File (conditional):** `src/components/employee/dashboard/TopActions.tsx`

Note: Original plan referenced a `lead-communications` query that does not exist in current TopActions.tsx. Current query at lines 84-107 (`top-actions-overdue`) already filters by `evanId` via `.eq('team_member_id', evanId!)`.

Subtasks:

- [ ] Re-read `TopActions.tsx` to confirm only the `top-actions-overdue` query exists and is properly scoped
- [ ] If a stale `lead-communications` query is found (Task 0 grep result), apply original scoping logic: extract `leadIds` from leads data, use `.in('lead_id', leadIds)`, gate with `enabled: !!evanId && leadIds.length > 0`
- [ ] If no stale query exists, mark this task as N/A and document with ➕ note
- [ ] Run `npm run build` — must pass

**Acceptance:**

- All TopActions queries either filter by `team_member_id = evanId` or by a `leadIds` array derived from user-scoped leads
- No global communications fetch remains in TopActions

### Task 4: Lazy-load below-the-fold widgets

**File:** `src/pages/admin/Dashboard.tsx`

Subtasks:

- [ ] Update React import on line 1: add `lazy, Suspense` → `import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react'`
- [ ] Replace static imports at lines 25-26 with lazy imports:
  - `const NudgesWidget = lazy(() => import('@/components/employee/dashboard/NudgesWidget'))`
  - `const TopActions = lazy(() => import('@/components/employee/dashboard/TopActions'))`
- [ ] Confirm both modules export `default` (NudgesWidget.tsx line 326 and TopActions.tsx line 390 both use `export default`)
- [ ] Wrap `<NudgesWidget evanId={evanId} />` (line 322) with `<Suspense fallback={<Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>}>`
- [ ] If `DashboardErrorBoundary` is in place (per Task 0), nest Suspense inside it: `<DashboardErrorBoundary name="Nudges"><Suspense ...>...</Suspense></DashboardErrorBoundary>`
- [ ] Apply same Suspense wrapping pattern to `<TopActions evanId={evanId} />` (line 323)
- [ ] Run `npm run build` — confirm new chunks appear in dist (look for separate NudgesWidget/TopActions chunk files)

**Acceptance:**

- Network tab shows NudgesWidget and TopActions JS chunks load after initial paint, not in the main bundle
- Suspense fallback (spinner card) appears briefly while chunks load
- Widgets render and function identically once loaded
- No layout shift greater than minor placeholder swap

### Task 5: Final verification

Subtasks:

- [ ] `npm run build` — clean build with no TypeScript errors
- [ ] `npm run lint` — no new lint warnings introduced
- [ ] Manual smoke test on `/admin/:name` dashboard:
  - Load dashboard, confirm no DB inserts in Network tab on mount
  - Click "Create All Tasks" in NudgesWidget → tasks appear in `tasks` table, success toast shown
  - Scroll to NudgesWidget/TopActions → confirm Suspense fallback briefly shows
  - On `/superadmin/dashboard`, trigger rapid edits to a row in `dashboard_deals` → only one refetch fires

**Acceptance:**

- Total initial query count is ~8 (down from ~15) verified via React Query Devtools
- All widgets render normally; no console errors

### Task 6: Update documentation

**Files:**

- Modify: `docs/plans/2026-04-09-dashboard-phase3-architecture.md` (this file)
- Move: this file → `docs/plans/completed/2026-04-09-dashboard-phase3-architecture.md`

Subtasks:

- [ ] Mark all tasks `[x]` when complete
- [ ] Add ➕ notes for any discoveries (e.g., Task 3 N/A status)
- [ ] Move plan to `docs/plans/completed/` once verification passes

## Post-Completion (manual verification, not automatable)

- Open Dashboard — NudgesWidget should NOT auto-create tasks on load
- Click "Create All Tasks" button — tasks created, toast shown, list refreshes
- Verify Network tab: below-the-fold widget chunk files load after initial paint
- TopActions only shows actions for current user's assigned tasks
- SuperAdmin dashboard: rapid changes are debounced into single refetch
- Suspense fallback (spinner) shows briefly then content loads
- Verify total initial query count is ~8 (down from ~15)
