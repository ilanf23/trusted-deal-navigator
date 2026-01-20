-- Add team_member_name column to calendar_connections to support per-team-member calendars
ALTER TABLE public.calendar_connections 
ADD COLUMN team_member_name TEXT;

-- Create unique constraint on team_member_name (one calendar per team member)
CREATE UNIQUE INDEX idx_calendar_connections_team_member 
ON public.calendar_connections (team_member_name) 
WHERE team_member_name IS NOT NULL;

-- Update RLS policies to allow team owners to manage any team member's calendar
DROP POLICY IF EXISTS "Users can view their own calendar connection" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can insert their own calendar connection" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can update their own calendar connection" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own calendar connection" ON public.calendar_connections;

-- New policies that allow access based on team membership
CREATE POLICY "Team members can view calendar connections"
ON public.calendar_connections FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_team_owner()
  OR public.can_access_team_member(team_member_name)
);

CREATE POLICY "Team members can insert calendar connections"
ON public.calendar_connections FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.is_team_owner()
  OR public.can_access_team_member(team_member_name)
);

CREATE POLICY "Team members can update calendar connections"
ON public.calendar_connections FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.is_team_owner()
  OR public.can_access_team_member(team_member_name)
);

CREATE POLICY "Team members can delete calendar connections"
ON public.calendar_connections FOR DELETE
USING (
  user_id = auth.uid()
  OR public.is_team_owner()
  OR public.can_access_team_member(team_member_name)
);