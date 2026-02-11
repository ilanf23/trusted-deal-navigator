

## Remove Hardcoded Admin Email -- Database-Driven Role System

### What's Changing

Right now, admin access is partly determined by checking if a user's email is `ilan@maverich.ai` in the code. Similarly, employee routing (Evan, Maura, Wendy) uses hardcoded email lists. This is insecure and not scalable. We'll replace all of this with the existing `user_roles` table and `team_members` table, which already have the right data.

### Current State (What Already Works)

- A `user_roles` table exists with `admin`, `client`, `partner` roles -- and both Ilan and Evan already have `admin` rows
- A `team_members` table exists with `is_owner`, `name`, and `user_id` -- already used by `EmployeeRoute`
- `AuthContext` already fetches `userRole` from the database
- The `has_role()` database function already powers all RLS policies

The problem is just **3 files** that still have hardcoded email checks layered on top.

### Changes

#### 1. `src/contexts/AuthContext.tsx`
- Remove `const ADMIN_EMAIL = 'ilan@maverich.ai'`
- Remove `const emailIsAdmin = ...` line
- Change `isAdmin` to simply be `userRole === 'admin'`
- No other changes needed -- the database fetch is already solid

#### 2. `src/components/auth/ProtectedRoute.tsx`
- Remove the `TEAM_MEMBER_EMAILS` constant
- Remove the email-based team member redirect block
- Instead, use the `team_members` table (via `useTeamMember` hook) to detect if the logged-in user is a non-owner team member trying to access admin routes, and redirect them to their own dashboard path
- Keep the existing `requireAdmin`, `clientOnly`, and partner redirect logic (these already use `userRole` and `isAdmin` from the database)

#### 3. `src/pages/Auth.tsx`
- Remove the hardcoded `employeeRoutes` map and `ilan@maverich.ai` check
- After login, use the `team_members` table to determine redirect: if user is a team member, route to their dashboard; otherwise fall through to existing role-based routing
- This will be done by importing and using `useTeamMember` (or a direct query) to look up the logged-in user's team member record

### What Won't Change
- The `user_roles` table, `app_role` enum, and `has_role()` function -- all already correct
- All RLS policies -- they already use `has_role()`, not email checks
- `EmployeeRoute` component -- already uses `useTeamMember` hook, no hardcoded emails
- Edge functions -- the one reference to `ilan@maverich.ai` in `call-to-lead-automation` is a notification recipient, not an auth check

### Security Notes
- Frontend role checks remain UX-only; all data access is already enforced by RLS policies using `has_role()`
- Adding new admins requires only inserting a row in `user_roles` -- no code changes needed

---

### Technical Details

**AuthContext.tsx diff summary:**
```
- const ADMIN_EMAIL = 'ilan@maverich.ai';
  ...
- const emailIsAdmin = (user?.email ?? '').toLowerCase() === ADMIN_EMAIL;
  ...
- isAdmin: emailIsAdmin || userRole === 'admin',
+ isAdmin: userRole === 'admin',
```

**ProtectedRoute.tsx approach:**
- Import `useTeamMember` hook
- If `requireAdmin` and user is a team member but NOT an owner, redirect to `/admin/{name}` or `/superadmin/{name}` based on `is_owner`
- Remove the static email map entirely

**Auth.tsx approach:**
- After login, query `team_members` via the existing RPC or hook
- If user is a team member: redirect to `/superadmin/{name}` (owners) or `/admin/{name}` (employees)
- If user is a partner: redirect to `/partner`
- If user is admin (non-team-member): redirect to `/superadmin`
- Otherwise: redirect to `/user`

