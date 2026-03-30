-- Fix handle_new_user() trigger to honor the signup_role from user metadata
-- and create a team_members record for admin signups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _valid_role public.app_role;
  _display_name text;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);

  -- Read the role the user selected during signup
  _role := COALESCE(NEW.raw_user_meta_data->>'signup_role', 'client');

  -- Validate against the app_role enum; default to 'client' if invalid
  BEGIN
    _valid_role := _role::public.app_role;
  EXCEPTION WHEN invalid_text_representation THEN
    _valid_role := 'client';
  END;

  -- Create user_roles record with the selected role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _valid_role);

  -- For admin signups, also create a team_members record so the sidebar works
  IF _valid_role = 'admin' THEN
    _display_name := split_part(NEW.email, '@', 1);
    INSERT INTO public.team_members (name, email, user_id, role, is_owner, is_active)
    VALUES (_display_name, NEW.email, NEW.id, 'Team Member', false, true);
  END IF;

  RETURN NEW;
END;
$$;
