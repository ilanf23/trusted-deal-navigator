

## Fix: Sidebar Resets on Navigation

### Root Cause

Every superadmin route in `App.tsx` independently wraps its page in `<ProtectedRoute><Page /></ProtectedRoute>`. The `AdminLayout` is rendered inside each page component (or `ProtectedRoute`), so when you navigate between routes, React unmounts and remounts the entire layout -- including the sidebar. This destroys all sidebar state (open/closed sections, scroll position).

This is the same problem that was already solved for the Partner portal using `PartnerRouteLayout` (a persistent layout with nested `<Outlet />`).

### Solution

Create a persistent layout route for superadmin pages, following the same pattern as `PartnerRouteLayout`.

### Changes

**1. Create `src/components/admin/AdminRouteLayout.tsx`**

A simple wrapper component that:
- Renders `ProtectedRoute` with `requireAdmin`
- Renders `AdminLayout` once (persistent across route changes)
- Uses React Router's `<Outlet />` to render child routes

**2. Update `src/App.tsx`**

Convert all flat superadmin routes from:
```
<Route path="/superadmin" element={<ProtectedRoute requireAdmin><SuperAdminDashboard /></ProtectedRoute>} />
<Route path="/superadmin/leads" element={<ProtectedRoute requireAdmin><AdminLeads /></ProtectedRoute>} />
...
```

To nested routes under one persistent layout:
```
<Route element={<AdminRouteLayout />}>
  <Route path="/superadmin" element={<SuperAdminDashboard />} />
  <Route path="/superadmin/leads" element={<AdminLeads />} />
  ...
</Route>
```

This ensures `AdminLayout` (and its sidebar) stays mounted when navigating between superadmin pages.

**3. Update page components that render AdminLayout themselves**

Any superadmin page that currently wraps its content in `<AdminLayout>` will need that wrapper removed, since the layout is now provided by the route layout. Each affected page file will be checked and the redundant `<AdminLayout>` wrapper stripped.

### Files

| Action | File |
|--------|------|
| Create | `src/components/admin/AdminRouteLayout.tsx` |
| Edit   | `src/App.tsx` -- nest superadmin routes under layout route |
| Edit   | All superadmin page components that wrap in `AdminLayout` -- remove the wrapper |

### Why This Works

- The sidebar component stays mounted across navigations, so `openSections` state, scroll position, and collapsed/expanded state all persist
- Matches the proven pattern already used for Partner portal (`PartnerRouteLayout`)
- No changes needed to the sidebar component itself
