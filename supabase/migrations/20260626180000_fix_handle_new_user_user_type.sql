-- Fix: signup fails with "Database error saving new user".
--
-- The privilege-escalation hardening in 20260625025605 rewrote handle_new_user()
-- based on the older function body, which INSERTs into public.users.user_type.
-- That column no longer exists on public.users (it was removed out-of-band; there
-- is no DROP migration in the repo), so every signup INSERT errors on a missing
-- column and Supabase Auth reports "Database error saving new user".
--
-- This keeps the security whitelist (self-service signup may only ever create
-- 'client' or 'partner', untrusted text is never cast to the app_role enum) and
-- simply stops referencing the nonexistent user_type column.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _signup_role text;
  _valid_role public.app_role;
  _display_name text;
BEGIN
  _signup_role := COALESCE(NEW.raw_user_meta_data->>'signup_role', 'client');

  -- Whitelist: only 'partner' maps to partner; everything else (including the
  -- privileged 'admin'/'super_admin' values) is coerced to 'client'.
  IF _signup_role = 'partner' THEN
    _valid_role := 'partner';
  ELSE
    _valid_role := 'client';
  END IF;

  _display_name := split_part(NEW.email, '@', 1);
  INSERT INTO public.users (name, email, user_id, app_role, is_owner, is_active)
  VALUES (_display_name, NEW.email, NEW.id, _valid_role, false, true);

  RETURN NEW;
END;
$$;
