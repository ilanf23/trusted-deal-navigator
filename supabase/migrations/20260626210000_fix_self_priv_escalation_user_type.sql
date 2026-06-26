-- Fix: every UPDATE on public.users fails with
--   record "new" has no field "user_type"
--
-- prevent_user_self_privilege_escalation() (from 20260625025605) still references
-- NEW.user_type / OLD.user_type, but the user_type column was dropped from
-- public.users out-of-band (same root cause that broke handle_new_user, fixed in
-- 20260626180000). Because this is a BEFORE UPDATE trigger that always evaluates
-- that expression, ALL role/owner updates currently error out.
--
-- This drops the user_type reference and otherwise preserves the guard: an
-- authenticated end user still cannot change app_role / is_owner / user_id on
-- their own row; service-role context and admins managing other rows are allowed.
CREATE OR REPLACE FUNCTION public.prevent_user_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- No authorization-sensitive column changed → nothing to guard.
  IF NEW.app_role  IS NOT DISTINCT FROM OLD.app_role
     AND NEW.is_owner IS NOT DISTINCT FROM OLD.is_owner
     AND NEW.user_id  IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- Server-side / service-role context (no end-user JWT) is trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- An authenticated end user is changing a sensitive column on THEIR OWN row → reject.
  IF auth.uid() = OLD.user_id THEN
    RAISE EXCEPTION
      'Changing app_role, is_owner, or user_id on your own account is not permitted; use the manage-user-role function'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Otherwise an admin is managing another user's row (gated by RLS) → allow.
  RETURN NEW;
END;
$$;
