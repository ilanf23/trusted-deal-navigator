# Fix Dashboard Slow Loading & Console Errors — Master Plan

## Overview

The `/admin/dashboard` page fires ~15 parallel Supabase queries on mount, many with aggressive cache-busting that overrides the global 2-minute staleTime. This causes a flood of console errors, slow load times, and duplicate data fetching. There are zero error boundaries, so every failing query crashes silently into the console.

The fix is split into 3 independent phase plans, each self-contained and shippable:

| Phase | Plan File | Risk | Impact |
|-------|-----------|------|--------|
| 1. Fix Caching & Deduplicate | [Phase 1](./2026-04-09-dashboard-phase1-caching.md) | Very low | ~50-60% query reduction, cache-busting eliminated |
| 2. Error Handling | [Phase 2](./2026-04-09-dashboard-phase2-errors.md) | Low | Zero console errors visible, graceful fallback UI |
| 3. Architecture Improvements | [Phase 3](./2026-04-09-dashboard-phase3-architecture.md) | Moderate | Side effects removed, queries scoped, lazy loading |

## Problem Summary

| Issue | Severity | Root Cause |
|-------|----------|------------|
| ~15 queries fire simultaneously on mount | Critical | Each widget fetches independently, no coordination |
| 4 queries override global cache with `staleTime: 0` | Critical | `useDashboardData.ts` lines 41-42, 56-57, 72-73, 91-92 |
| 2 duplicate funded-deals queries | High | `fundedQuery` + `companyDealsQuery` both hit `potential WHERE funded` |
| 2 duplicate communications queries | High | `touchpointsQuery` + `scorecardCommsQuery` both hit `communications` this week |
| NudgesWidget auto-creates tasks on mount | High | `useEffect` at NudgesWidget.tsx:94-143 writes to DB every page load |
| Zero error boundaries | High | Any failing query floods console with unhandled errors |
| Default 3 retries per query | Medium | Each failing query generates 4 error lines (1 + 3 retries) |
| SuperAdmin realtime thundering herd | Medium | Single row change refetches all 5 queries |
| TopActions fetches 100 comms globally | Medium | No team member scoping on communications query |

## Context

- **Global query config:** `App.tsx:96-103` — `staleTime: 1000 * 60 * 2` (2 min), `refetchOnWindowFocus: false`
- **Existing error boundary patterns:** `PanelErrorBoundary` in `src/components/admin/splitview/SplitViewPanel.tsx:13-51`, `UWErrorBoundary` in `src/pages/admin/Underwriting.tsx:1717-1725`
- **Testing approach:** Manual verification only — no automated tests in this project (Playwright installed but not actively used)
- **Database types:** All tables/views used by SuperAdmin dashboard exist in `src/integrations/supabase/types.ts`

## Query Count Summary

| Stage | Queries on Mount | Notes |
|-------|-----------------|-------|
| Before (current) | ~15 | All fire simultaneously, 4 bypass cache |
| After Phase 1 | ~12 | 2 duplicates removed, retry reduction, all cached |
| After Phase 2 | ~12 | Same count, but errors handled gracefully |
| After Phase 3 | ~8 on initial, +4 lazy | Below-fold queries deferred, comms scoped |

## Files Modified

| File | Phase |
|------|-------|
| `src/components/admin/dashboard/useDashboardData.ts` | 1 |
| `src/components/employee/dashboard/RevenueChart.tsx` | 1, 2 |
| `src/components/shared/DashboardErrorBoundary.tsx` (new) | 2 |
| `src/pages/admin/Dashboard.tsx` | 2, 3 |
| `src/components/employee/dashboard/TopActions.tsx` | 2, 3 |
| `src/components/employee/dashboard/NudgesWidget.tsx` | 2, 3 |
| `src/hooks/useSuperAdminDashboard.ts` | 2, 3 |
