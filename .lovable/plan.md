
# URL Slug Restructure

## Summary
Reorganize all backend page URLs to follow a consistent permission-based structure:
- **Evan, Maura, Wendy** (employees): `/admin/{name}/*`
- **Brad, Adam, Ilan** (founders): `/superadmin/{name}/*`  
- **Super Admin Dashboard + shared pages** (CRM, Leads, Clients, etc.): `/superadmin/*`
- **Partner, Client**: unchanged (`/partner/*`, `/user/*`)
- Keep `/team/evan/*` and `/user/evan/*` as legacy redirects

---

## Changes by File

### 1. `src/App.tsx` -- Route Definitions
- Rename all `/admin/*` shared pages to `/superadmin/*` (e.g., `/superadmin/crm`, `/superadmin/leads`, `/superadmin/clients`)
- Move Evan routes from `/user/evan/*` and `/team/evan/*` to `/admin/evan/*` (keep old paths as legacy)
- Move Maura from `/team/maura` to `/admin/maura`
- Move Wendy from `/team/wendy` to `/admin/wendy`
- Move Brad from `/admin/brad` to `/superadmin/brad`
- Move Adam from `/admin/adam` to `/superadmin/adam`
- Move Ilan from `/admin/ilan/*` to `/superadmin/ilan/*`
- Move callback routes: `/admin/inbox/callback` to `/superadmin/inbox/callback`, etc.
- SuperAdminDashboard: `/admin` becomes `/superadmin`

### 2. `src/components/auth/ProtectedRoute.tsx`
- Update `TEAM_MEMBER_EMAILS` mapping: Evan/Maura/Wendy now redirect to `/admin/{name}`

### 3. `src/pages/Auth.tsx`
- Update `employeeRoutes` mapping: all employees redirect to `/admin/{name}`
- Ilan redirect from `/admin/ilan` to `/superadmin/ilan`
- Default admin redirect from `/admin` to `/superadmin`

### 4. `src/components/admin/AdminSidebar.tsx`
- **Ilan's nav**: all URLs change from `/admin/*` to `/superadmin/*` (e.g., `/superadmin/crm`, `/superadmin/ilan/dev`)
- **Owner nav**: all URLs change from `/admin/*` to `/superadmin/*`
- **Employee nav**: URLs change from `/team/{name}/*` to `/admin/{name}/*`
- Update `homeUrl` logic: founders use `/superadmin/{name}`, employees use `/admin/{name}`
- Update `isActive` path matching

### 5. `src/components/admin/EmployeeRoute.tsx`
- Update redirect logic: employees redirect to `/admin/{name}`, founders to `/superadmin/{name}`

### 6. `src/pages/admin/SuperAdminDashboard.tsx`
- Update redirect logic for non-owners: employees to `/admin/{name}`, founders to `/superadmin/{name}`
- Update team member `url` references (e.g., Brad to `/superadmin/brad`, Evan to `/admin/evan`)

### 7. `src/pages/admin/EvansPipeline.tsx`
- Update navigation links: `/team/evan/calls` to `/admin/evan/calls`, `/team/evan/leads` to `/admin/evan/leads`

### 8. `src/contexts/CallContext.tsx`
- Update call auto-navigation paths from `/team/evan/calls` to `/admin/evan/calls`

### 9. `src/components/evan/dashboard/NudgesWidget.tsx`
- Update link from `/team/evan/gmail` to `/admin/evan/gmail`

### 10. `src/components/evan/EvanCalendarWidget.tsx`
- Update callback URL from `/admin/calendar-callback` to `/superadmin/calendar-callback`

### 11. `src/hooks/useGmail.ts`
- Update redirect URI from `/admin/inbox/callback` to `/superadmin/inbox/callback`

### 12. `src/hooks/useGoogleSheets.ts`
- Update redirect URI from `/admin/sheets-callback` to `/superadmin/sheets-callback`

### 13. `src/pages/admin/IlansGmail.tsx`
- Update callback URL from `/admin/inbox/callback` to `/superadmin/inbox/callback`

### 14. Other files with hardcoded `/team/evan` links
- Various dashboard widgets, task components, and evan-specific components will need link updates from `/team/evan/*` to `/admin/evan/*`

---

## URL Mapping Summary

```text
OLD                              NEW
----                             ----
/admin                        -> /superadmin
/admin/crm                    -> /superadmin/crm
/admin/leads                  -> /superadmin/leads
/admin/clients                -> /superadmin/clients
/admin/contracts              -> /superadmin/contracts
/admin/invoices               -> /superadmin/invoices
/admin/messages               -> /superadmin/messages
/admin/marketing              -> /superadmin/marketing
/admin/newsletter             -> /superadmin/newsletter
/admin/rate-watch             -> /superadmin/rate-watch
/admin/lender-programs        -> /superadmin/lender-programs
/admin/tracking               -> /superadmin/tracking
/admin/bug-reporting          -> /superadmin/bug-reporting
/admin/team-performance       -> /superadmin/team-performance
/admin/inbox/callback         -> /superadmin/inbox/callback
/admin/calendar-callback      -> /superadmin/calendar-callback
/admin/sheets-callback        -> /superadmin/sheets-callback
/admin/brad                   -> /superadmin/brad
/admin/adam                   -> /superadmin/adam
/admin/ilan                   -> /superadmin/ilan
/admin/ilan/*                 -> /superadmin/ilan/*
/team/evan/*                  -> /admin/evan/*  (keep /team/evan as legacy)
/team/maura                   -> /admin/maura
/team/wendy                   -> /admin/wendy
```

## No Changes
- `/partner/*` routes (unchanged)
- `/user/*` client portal routes (unchanged)
- Public routes (unchanged)
