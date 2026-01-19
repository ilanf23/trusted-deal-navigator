-- Add user_id column to team_members to link auth users to team members
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create unique constraint on user_id
ALTER TABLE public.team_members 
ADD CONSTRAINT team_members_user_id_unique UNIQUE (user_id);

-- Add is_owner column to identify Brad and Adam as super admins
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false;

-- Create a security definer function to get the current user's team member info
CREATE OR REPLACE FUNCTION public.get_current_team_member()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_owner BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.id, tm.name, tm.email, tm.role, tm.is_owner
  FROM public.team_members tm
  WHERE tm.user_id = auth.uid()
  LIMIT 1
$$;

-- Create a function to check if current user is an owner (super admin)
CREATE OR REPLACE FUNCTION public.is_team_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_owner FROM public.team_members WHERE user_id = auth.uid()),
    false
  )
$$;

-- Create a function to check if current user can access a specific team member's data
CREATE OR REPLACE FUNCTION public.can_access_team_member(_team_member_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE user_id = auth.uid() 
    AND (is_owner = true OR LOWER(name) = LOWER(_team_member_name))
  )
$$;