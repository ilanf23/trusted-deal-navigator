-- Consolidate self-service signup onto the admin portal.
--
-- Product state: the app currently ships only an admin portal (no borrower/client
-- or partner portal yet), so the signup UI no longer asks "borrower vs partner".
-- Every new account is provisioned as 'admin' so it lands in the only portal that
-- exists today.
--
-- SECURITY NOTE: this intentionally reverses the privilege-escalation hardening in
-- 20260625025605 / 20260626180000, which forced self-service signups to 'client'/
-- 'partner' so a public signup could never mint an admin. With this migration ANY
-- public signup becomes a full admin. That is acceptable for the current pre-launch
-- phase but MUST be revisited before the app is publicly available (e.g. switch to
-- invite-only / admin-created accounts, or gate signup behind an allowlist).
--
-- The role is assigned server-side here (not from untrusted client metadata), so
-- we never cast raw signup_role text to the app_role enum.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name text;
BEGIN
  _display_name := split_part(NEW.email, '@', 1);

  -- Only an admin portal exists today: every new account is provisioned as admin.
  INSERT INTO public.users (name, email, user_id, app_role, is_owner, is_active)
  VALUES (_display_name, NEW.email, NEW.id, 'admin'::public.app_role, false, true);

  RETURN NEW;
END;
$$;
