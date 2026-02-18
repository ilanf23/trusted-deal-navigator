
# Fix Ilan's Landing Page and Navigation Slug

## Problem Summary

When Ilan logs in, he is routed to `/superadmin/ilan` which currently renders the `TeamPerformance` page. Two issues need fixing:

1. **Wrong landing page** - `/superadmin/ilan` renders `<TeamPerformance />` instead of `<IlansPage />` (the WOP Developer Dashboard)
2. **Incorrect sidebar links** - In `AdminSidebar.tsx`, the "WOP" nav item points to `/superadmin/ilan/dev` and the "Team Performance" item points to `/superadmin/ilan` — these are swapped from what they should be

## Root Cause

In `src/App.tsx` line 132:
```tsx
// CURRENT (wrong)
<Route path="/superadmin/ilan" element={<EmployeeRoute employeeName="Ilan"><TeamPerformance /></EmployeeRoute>} />
<Route path="/superadmin/ilan/dev" element={<EmployeeRoute employeeName="Ilan"><IlansPage /></EmployeeRoute>} />
```

And in `src/components/admin/AdminSidebar.tsx` lines 96 and 161:
```tsx
// CURRENT (wrong)
{ title: 'WOP', url: '/superadmin/ilan/dev', icon: Code2 },   // Should be /superadmin/ilan
{ title: 'Team Performance', url: '/superadmin/ilan', icon: BarChart3 }, // Should be /superadmin/team-performance
```

## Fix Plan

### 1. `src/App.tsx` — Swap the route components

```tsx
// AFTER (correct)
<Route path="/superadmin/ilan" element={<EmployeeRoute employeeName="Ilan"><IlansPage /></EmployeeRoute>} />
<Route path="/superadmin/ilan/dev" element={<EmployeeRoute employeeName="Ilan"><TeamPerformance /></EmployeeRoute>} />
```

This ensures that when Ilan logs in and is redirected to `/superadmin/ilan`, he lands on the WOP Developer Dashboard.

### 2. `src/components/admin/AdminSidebar.tsx` — Fix the two sidebar URLs

```tsx
// AFTER (correct)
{ title: 'WOP', url: '/superadmin/ilan', icon: Code2 },
{ title: 'Team Performance', url: '/superadmin/ilan/dev', icon: BarChart3 },
```

This makes the "WOP" sidebar link go to the root `/superadmin/ilan` (which now renders IlansPage), and "Team Performance" goes to `/superadmin/ilan/dev`.

## Files to Change

| File | Change |
|------|--------|
| `src/App.tsx` | Swap `IlansPage` and `TeamPerformance` on the `/superadmin/ilan` and `/superadmin/ilan/dev` routes |
| `src/components/admin/AdminSidebar.tsx` | Update WOP URL to `/superadmin/ilan` and Team Performance URL to `/superadmin/ilan/dev` |

## Technical Notes

- No new routes, pages, or components are needed — this is purely a URL/component mapping fix
- The `Auth.tsx` redirect logic already correctly sends Ilan to `/superadmin/ilan` based on `teamMember.is_owner` check — no changes needed there
- The `/superadmin/ilan/dev` slug makes logical sense as a secondary developer tools page (Team Performance from Ilan's perspective is a secondary tool, not his home)
- All other `/superadmin/ilan/*` sub-routes (gmail, bugs, team, users-roles) remain unchanged
