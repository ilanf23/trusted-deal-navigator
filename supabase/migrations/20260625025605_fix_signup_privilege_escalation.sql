-- Security fix: close two self-service privilege-escalation paths into public.users.
--
-- Background: app_role is the authorization role (admin / super_admin / partner / client)
-- stored on public.users. Two paths let an unprivileged user grant themselves a
-- privileged role:
--
--   1. SIGNUP TRIGGER — public.handle_new_user() trusted raw_user_meta_data->>'signup_role'
--      and assigned it directly to app_role. raw_user_meta_data is fully user-controlled,
--      so `signup_role: 'admin'` (or 'super_admin') created an admin/super_admin account.
--      (The previous code cast the raw text straight to the app_role enum; because the enum
--      contains 'admin' and 'super_admin', the cast happily accepted them.)
--
--   2. SELF-UPDATE — the "Users can update own profile" RLS policy allows a user to UPDATE
--      their own row with no column restriction, and RLS WITH CHECK cannot inspect OLD, so
--      a client could run `UPDATE users SET app_role='admin' WHERE user_id = auth.uid()`
--      via the Data API and bypass the trigger entirely.
--
-- The trusted path for privileged role changes remains the manage-user-role edge function
-- (service role, requireAdmin, super_admin gating). This migration does not change it.

-- ============================================================
-- Fix 1: handle_new_user() — self-service signup may only ever create 'client' or 'partner'
-- ============================================================
-- We WHITELIST the role explicitly and never cast the untrusted text to the enum.
-- Anything that is not exactly 'partner' becomes 'client'. This coerces 'admin' and
-- 'super_admin' (and any other value) to 'client' regardless of current enum membership.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _signup_role text;
  _valid_role public.app_role;
  _user_type text;
  _display_name text;
BEGIN
  _signup_role := COALESCE(NEW.raw_user_meta_data->>'signup_role', 'client');

  IF _signup_role = 'partner' THEN
    _valid_role := 'partner';
    _user_type  := 'partner';
  ELSE
    _valid_role := 'client';
    _user_type  := 'client';
  END IF;

  _display_name := split_part(NEW.email, '@', 1);
  INSERT INTO public.users (name, email, user_id, app_role, user_type, is_owner, is_active)
  VALUES (_display_name, NEW.email, NEW.id, _valid_role, _user_type, false, true);

  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix 2: block self privilege escalation via direct UPDATE
-- ============================================================
-- A BEFORE UPDATE trigger that rejects changes to authorization-sensitive columns when the
-- caller is editing their OWN row. This mirrors manage-user-role's existing "cannot change
-- your own role" invariant.
--
--   * Service-role / migration callers (no end-user JWT, auth.uid() IS NULL) are allowed,
--     so the manage-user-role edge function continues to work.
--   * Admins editing OTHER users' rows (auth.uid() <> OLD.user_id) are allowed, so the
--     existing admin "Users & Roles" UI continues to work, gated by the
--     "Admins can manage team members" RLS policy.
--   * A user changing app_role / is_owner / user_type / user_id on their own row is blocked.
CREATE OR REPLACE FUNCTION public.prevent_user_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- No authorization-sensitive column changed → nothing to guard.
  IF NEW.app_role   IS NOT DISTINCT FROM OLD.app_role
     AND NEW.is_owner   IS NOT DISTINCT FROM OLD.is_owner
     AND NEW.user_type  IS NOT DISTINCT FROM OLD.user_type
     AND NEW.user_id    IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- Server-side / service-role context (no end-user JWT) is trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- An authenticated end user is changing a sensitive column on THEIR OWN row → reject.
  IF auth.uid() = OLD.user_id THEN
    RAISE EXCEPTION
      'Changing app_role, is_owner, user_type, or user_id on your own account is not permitted; use the manage-user-role function'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Otherwise an admin is managing another user's row (gated by RLS) → allow.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_self_privilege_escalation ON public.users;
CREATE TRIGGER prevent_user_self_privilege_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_self_privilege_escalation();
