

## Add "Users & Roles" Page to Ilan's Superadmin Portal

### Overview

A new page at `/superadmin/ilan/users-roles` that lists all users and their roles, allowing Ilan to upgrade/downgrade roles with a single button press after re-entering his own password for security confirmation.

### How It Works

1. Page loads a table of all users (from `profiles` joined with `user_roles`)
2. Each row shows user email, current role(s), and action buttons to set role (admin / partner / client)
3. Clicking a role-change button opens a confirmation dialog that requires Ilan to enter **his own account password**
4. The password is verified by calling `supabase.auth.signInWithPassword()` with Ilan's email + entered password
5. If verified, an edge function (`manage-user-role`) performs the actual role change using the service role key
6. The edge function validates the caller is an admin (same pattern as `admin-update-user`)

### Available Roles

The existing `app_role` enum supports: `admin`, `client`, `partner`. There is no `superadmin` enum value in the database, so roles will be limited to these three. If you want a `superadmin` level, we can add it to the enum in a follow-up.

### Changes

**1. New edge function: `supabase/functions/manage-user-role/index.ts`**
- Accepts `{ target_user_id, new_role }` in the request body
- Validates caller JWT and confirms caller has `admin` role (via `user_roles` table using service role client)
- Upserts the target user's role in `user_roles` (replaces existing role or inserts new one)
- Returns success/failure

**2. New page: `src/pages/admin/UsersAndRoles.tsx`**
- Fetches all profiles + their roles using a single query
- Displays a table with columns: Email, Current Role, Actions
- Action buttons for each role (admin / partner / client) -- the current role is visually highlighted/disabled
- Clicking a different role opens a dialog asking for the caller's password
- On submit: calls `signInWithPassword` to verify, then calls the edge function
- Shows success/error toast

**3. Update `src/components/admin/AdminSidebar.tsx`**
- Add "Users & Roles" link right below "WOP" in Ilan's top-level section, using the `Users` icon (already imported)

**4. Update `src/App.tsx`**
- Add route `/superadmin/ilan/users-roles` inside the existing `AdminRouteLayout` block, wrapped with `EmployeeRoute employeeName="Ilan"`

**5. Database migration**
- Add RLS policy on `user_roles` so admins can SELECT all rows (currently no SELECT policy exists for admins to list all roles)

### Security

- Password re-authentication happens client-side via Supabase Auth (`signInWithPassword`) before the edge function is called
- The edge function independently verifies the caller is an admin via JWT + `user_roles` table lookup (same pattern as `admin-update-user`)
- Role changes use the service role key server-side only
- Rate limited (3 requests per 60 seconds, matching existing pattern)

### Files Summary

| Action | File |
|--------|------|
| Create | `supabase/functions/manage-user-role/index.ts` |
| Create | `src/pages/admin/UsersAndRoles.tsx` |
| Edit | `src/components/admin/AdminSidebar.tsx` -- add link below WOP |
| Edit | `src/App.tsx` -- add route |
| Migration | Add admin SELECT policy on `user_roles` |
