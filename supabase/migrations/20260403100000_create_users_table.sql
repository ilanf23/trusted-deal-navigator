-- Consolidate team_members + profiles + people into a single "users" table
-- Approach: RENAME team_members → users (Postgres auto-updates all FKs, indexes, RLS)

-- ============================================================
-- Step 1: Rename team_members → users
-- ============================================================
ALTER TABLE public.team_members RENAME TO users;

-- ============================================================
-- Step 2: Add columns from profiles
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- ============================================================
-- Step 3: Add user_type column
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'team_member';

-- ============================================================
-- Step 4: Backfill user_type from app_role
-- ============================================================
UPDATE public.users SET user_type = 'client'  WHERE app_role = 'client';
UPDATE public.users SET user_type = 'partner' WHERE app_role = 'partner';
-- admin/super_admin keep the default 'team_member'

-- ============================================================
-- Step 5: Backfill profile data into existing users rows
-- ============================================================
UPDATE public.users u
SET
  company_name  = COALESCE(u.company_name, p.company_name),
  contact_person = COALESCE(u.contact_person, p.contact_person),
  address       = COALESCE(u.address, p.address),
  city          = COALESCE(u.city, p.city),
  state         = COALESCE(u.state, p.state),
  zip_code      = COALESCE(u.zip_code, p.zip_code)
FROM public.profiles p
WHERE u.user_id IS NOT NULL
  AND u.user_id = p.user_id;

-- ============================================================
-- Step 6: Insert orphan profiles (clients with no users row)
-- ============================================================
INSERT INTO public.users (name, email, user_id, app_role, user_type, is_owner, is_active,
                          company_name, contact_person, address, city, state, zip_code)
SELECT
  COALESCE(p.contact_person, split_part(COALESCE(p.email, 'unknown'), '@', 1)),
  p.email,
  p.user_id,
  'client',
  'client',
  false,
  true,
  p.company_name,
  p.contact_person,
  p.address,
  p.city,
  p.state,
  p.zip_code
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.user_id = p.user_id
);

-- ============================================================
-- Step 7: Rewrite has_role() → reference public.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = _user_id
      AND app_role = _role
      AND is_active = true
  )
$$;

-- ============================================================
-- Step 8: Rewrite handle_new_user() → insert into public.users only
-- ============================================================
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
  _user_type text;
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'signup_role', 'client');

  BEGIN
    _valid_role := _role::public.app_role;
  EXCEPTION WHEN invalid_text_representation THEN
    _valid_role := 'client';
  END;

  IF _valid_role IN ('admin', 'super_admin') THEN
    _user_type := 'team_member';
  ELSIF _valid_role = 'partner' THEN
    _user_type := 'partner';
  ELSE
    _user_type := 'client';
  END IF;

  _display_name := split_part(NEW.email, '@', 1);
  INSERT INTO public.users (name, email, user_id, app_role, user_type, is_owner, is_active)
  VALUES (_display_name, NEW.email, NEW.id, _valid_role, _user_type, false, true);

  RETURN NEW;
END;
$$;

-- ============================================================
-- Step 9: Rewrite RPC functions → reference public.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_team_member()
RETURNS TABLE (id UUID, name TEXT, email TEXT, role TEXT, is_owner BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name, u.email, u.role, u.is_owner
  FROM public.users u
  WHERE u.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_owner FROM public.users WHERE user_id = auth.uid()),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_team_member(_team_member_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = auth.uid()
    AND (is_owner = true OR LOWER(name) = LOWER(_team_member_name))
  )
$$;

-- ============================================================
-- Step 10: Drop profiles table
-- ============================================================
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================
-- Step 11: Drop people + all sub-tables (all UNUSED in code)
-- ============================================================
DROP TABLE IF EXISTS public.people_files CASCADE;
DROP TABLE IF EXISTS public.people_activities CASCADE;
DROP TABLE IF EXISTS public.people_tasks CASCADE;
DROP TABLE IF EXISTS public.people_emails CASCADE;
DROP TABLE IF EXISTS public.people_phones CASCADE;
DROP TABLE IF EXISTS public.people_addresses CASCADE;
DROP TABLE IF EXISTS public.people CASCADE;

-- ============================================================
-- Step 12: Add RLS policy for self-service profile updates
-- ============================================================
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
