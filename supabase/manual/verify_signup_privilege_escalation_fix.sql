-- ============================================================================
-- Manual verification + audit for the signup privilege-escalation fix.
-- Run these AFTER applying 20260625025605_fix_signup_privilege_escalation.sql.
-- Every test is wrapped in BEGIN/ROLLBACK so it changes nothing permanently.
-- Run against staging first if you have one. Read each section's expected result.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Confirm the live enum membership (resolves "is super_admin a real value?")
-- ----------------------------------------------------------------------------
SELECT enum_range(NULL::public.app_role) AS app_role_values;
-- Expect something like: {admin,client,partner,super_admin}


-- ----------------------------------------------------------------------------
-- 1. Confirm the new function/trigger definitions are actually deployed
-- ----------------------------------------------------------------------------
SELECT proname, pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname IN ('handle_new_user', 'prevent_user_self_privilege_escalation')
ORDER BY proname;
-- handle_new_user should contain the "IF _signup_role = 'partner'" whitelist
-- and must NOT cast raw_user_meta_data to ::app_role.

SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass AND NOT tgisinternal
ORDER BY tgname;
-- Expect prevent_user_self_privilege_escalation (and the existing updated_at trigger).

-- Confirm handle_new_user is actually wired to auth.users (the whole signup fix
-- depends on this attachment; CREATE OR REPLACE alone does nothing if it isn't).
SELECT tgname, tgrelid::regclass AS attached_to, tgenabled
FROM pg_trigger
WHERE tgfoid = 'public.handle_new_user'::regproc;
-- Expect a row on auth.users, enabled ('O' = enabled).


-- ----------------------------------------------------------------------------
-- 2. SIGNUP TRIGGER tests — insert fake auth.users rows, check resulting role,
--    then ROLLBACK. (handle_new_user fires AFTER INSERT ON auth.users.)
--    NOTE: auth.users may have additional NOT NULL columns / triggers in your
--    project; if the INSERT errors, add the missing columns. The transaction
--    rolls back regardless, so nothing is persisted.
-- ----------------------------------------------------------------------------
-- NOTE: INSERT and SELECT are SEPARATE statements on purpose. A data-modifying
-- CTE runs under one snapshot and the outer SELECT cannot see the rows its own
-- INSERT (and the AFTER-INSERT trigger) wrote, so a combined query returns empty
-- even when the fix works.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (gen_random_uuid(), 'verif_none@example.test',        '{}'::jsonb),
  (gen_random_uuid(), 'verif_client@example.test',      '{"signup_role":"client"}'::jsonb),
  (gen_random_uuid(), 'verif_partner@example.test',     '{"signup_role":"partner"}'::jsonb),
  (gen_random_uuid(), 'verif_admin@example.test',       '{"signup_role":"admin"}'::jsonb),
  (gen_random_uuid(), 'verif_superadmin@example.test',  '{"signup_role":"super_admin"}'::jsonb),
  (gen_random_uuid(), 'verif_garbage@example.test',     '{"signup_role":"owner"}'::jsonb);

SELECT u.email, u.app_role, u.user_type
FROM public.users u
WHERE u.email LIKE 'verif_%@example.test'
ORDER BY u.email;
ROLLBACK;
-- Expected app_role / user_type:
--   verif_none        -> client  / client
--   verif_client      -> client  / client
--   verif_partner     -> partner / partner
--   verif_admin       -> client  / client   <-- escalation blocked
--   verif_superadmin  -> client  / client   <-- escalation blocked
--   verif_garbage     -> client  / client


-- ----------------------------------------------------------------------------
-- 3. SELF-UPDATE GUARD tests. auth.uid() reads request.jwt.claims->>'sub',
--    which we simulate with set_config. Pick a real non-admin user_id below.
-- ----------------------------------------------------------------------------

-- 3a. A user escalating their OWN role -> must RAISE insufficient_privilege.
BEGIN;
-- Replace with a real client/partner user_id from public.users:
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT user_id FROM public.users
                            WHERE app_role IN ('client','partner') AND user_id IS NOT NULL
                            LIMIT 1))::text, true);
UPDATE public.users
SET app_role = 'admin'
WHERE user_id = (current_setting('request.jwt.claims')::json->>'sub')::uuid;
-- Expected: ERROR ... insufficient_privilege. If you get "UPDATE 1", the guard FAILED.
ROLLBACK;

-- 3b. The same user editing a NON-sensitive column on their own row -> allowed.
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT user_id FROM public.users
                            WHERE app_role IN ('client','partner') AND user_id IS NOT NULL
                            LIMIT 1))::text, true);
UPDATE public.users
SET company_name = 'verif-self-edit'
WHERE user_id = (current_setting('request.jwt.claims')::json->>'sub')::uuid;
-- Expected: UPDATE 1 (no error).
ROLLBACK;

-- 3c. Service-role context (no JWT claim) changing a role -> allowed
--     (this is the manage-user-role path).
BEGIN;
SELECT set_config('request.jwt.claims', '', true);  -- auth.uid() -> NULL
UPDATE public.users
SET is_owner = NOT is_owner            -- a real change to a guarded column
WHERE id = (SELECT id FROM public.users WHERE user_id IS NOT NULL LIMIT 1);
-- Expected: UPDATE 1, no error. Confirms server-side (service-role) updates to
-- guarded columns are NOT blocked (the manage-user-role path). Rolled back below.
ROLLBACK;


-- ----------------------------------------------------------------------------
-- 4. AUDIT existing privileged accounts (step 6). The signup_role_meta column
--    reveals accounts that selected 'admin'/'super_admin' at self-signup —
--    those are the ones to downgrade or remove.
-- ----------------------------------------------------------------------------
SELECT
  u.id,
  u.user_id,
  u.email,
  u.app_role,
  u.is_owner,
  u.user_type,
  u.is_active,
  u.created_at,
  au.created_at                                AS auth_created_at,
  au.raw_user_meta_data->>'signup_role'        AS signup_role_meta,
  au.last_sign_in_at
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.user_id
WHERE u.app_role IN ('admin', 'super_admin')
   OR u.is_owner = true
ORDER BY u.created_at DESC;
-- Investigate any row where signup_role_meta IN ('admin','super_admin') — these
-- were created via the vulnerable self-signup path. Cross-check against your
-- known team. Downgrade with the manage-user-role edge function (as a super_admin),
-- or directly in SQL after confirming, e.g.:
--   UPDATE public.users SET app_role='client', user_type='client', is_owner=false
--   WHERE id = '<row id>';
-- For accounts that should not exist at all, delete the auth user via the
-- Supabase dashboard / Admin API (which cascades), not just the public.users row.
