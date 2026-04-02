-- Consolidate user_roles into team_members
-- This migration:
--   1. Adds app_role column to team_members
--   2. Migrates existing role data from user_roles
--   3. Creates team_members records for users that only existed in user_roles
--   4. Rewrites has_role() to query team_members
--   5. Rewrites handle_new_user() to insert into team_members (not user_roles)
--   6. Drops user_roles table

-- Step 1: Add app_role column to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS app_role public.app_role DEFAULT 'client';

-- Step 2: Backfill app_role from user_roles for existing team_members
UPDATE public.team_members tm
SET app_role = ur.role
FROM public.user_roles ur
WHERE tm.user_id IS NOT NULL
  AND tm.user_id = ur.user_id;

-- Step 3: Create team_members records for users in user_roles that have no team_members row
INSERT INTO public.team_members (name, email, user_id, app_role, is_owner, is_active)
SELECT
  COALESCE(p.contact_person, split_part(COALESCE(p.email, 'unknown'), '@', 1)),
  p.email,
  ur.user_id,
  ur.role,
  false,
  true
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm WHERE tm.user_id = ur.user_id
);

-- Step 4: Rewrite has_role() to use team_members
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND app_role = _role
      AND is_active = true
  )
$$;

-- Step 5: Rewrite handle_new_user() — no longer touches user_roles
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

  -- Create a team_members record for every new signup
  _display_name := split_part(NEW.email, '@', 1);
  INSERT INTO public.team_members (name, email, user_id, app_role, is_owner, is_active)
  VALUES (_display_name, NEW.email, NEW.id, _valid_role, false, true);

  RETURN NEW;
END;
$$;

-- Step 6: Drop user_roles RLS policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Step 7: Drop user_roles table (CASCADE to remove transitive policy dependencies via old has_role)
DROP TABLE public.user_roles CASCADE;

-- Step 8: Recreate any RLS policies that were dropped by CASCADE
-- (These policies use has_role() which now queries team_members)
CREATE POLICY "Admins can update active calls"
  ON public.active_calls FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all active calls"
  ON public.active_calls FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view dropbox connection"
  ON public.dropbox_connections FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view dropbox files"
  ON public.dropbox_files FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage dropbox files"
  ON public.dropbox_files FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage email templates"
  ON public.email_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read all ratewatch responses"
  ON public.ratewatch_questionnaire_responses FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view all ai changes"
  ON public.ai_agent_changes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view all ai batches"
  ON public.ai_agent_batches FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage lead_signals"
  ON public.lead_signals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage volume_log_sync_config"
  ON public.volume_log_sync_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 9: Add RLS policy so users can read their own team_members row (needed for auth)
CREATE POLICY "Users can view own team member record"
ON public.team_members
FOR SELECT
USING (auth.uid() = user_id);
