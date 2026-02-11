

## Fix: Add Admin Authorization to `admin-update-user` Edge Function

### Problem
The endpoint accepts requests from any authenticated user. There is no server-side check that the caller is an admin. Any logged-in user could update any other user's email or password.

### Solution
Extract the caller's identity from the JWT, query the existing `user_roles` table to verify they have the `admin` role, and reject with 403 if they don't.

### Changes

**File: `supabase/functions/admin-update-user/index.ts`**

1. **Extract caller identity from JWT** -- Parse the `Authorization` header, decode the JWT to get the caller's `sub` (user ID). Since `verify_jwt` is not disabled for this function, the gateway already validates the token, so we just need to extract claims.

2. **Query `user_roles` table for admin check** -- Using the service-role client (already created), query `user_roles` where `user_id = caller_id` and `role = 'admin'`. If no row exists, return 403.

3. **Log unauthorized attempts** -- On 401/403, log the caller ID, target user ID, and timestamp to the console.

4. **Return clear error codes** -- 401 if no valid JWT/user, 403 if not admin.

### Technical Detail

The function will add this block before the existing update logic:

```text
1. Get Authorization header
2. Create a user-context Supabase client to extract the caller
3. Decode JWT claims to get caller user_id (sub)
4. If no caller -> 401 Unauthorized
5. Query user_roles table: SELECT 1 FROM user_roles WHERE user_id = caller AND role = 'admin'
6. If no admin row -> 403 Forbidden (log: caller_id, target user_id, timestamp)
7. Proceed with existing update logic
```

No database changes needed -- the `user_roles` table and `has_role()` function already exist. No config.toml changes needed -- JWT verification is already enabled for this function.

