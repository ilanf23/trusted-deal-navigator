-- Create sheets_connections table for Google Sheets OAuth tokens
CREATE TABLE public.sheets_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_member_name TEXT DEFAULT 'admin',
  email VARCHAR NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sheets_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Team members can view sheets connections"
ON public.sheets_connections
FOR SELECT
USING ((user_id = auth.uid()) OR is_team_owner() OR can_access_team_member(team_member_name));

CREATE POLICY "Team members can insert sheets connections"
ON public.sheets_connections
FOR INSERT
WITH CHECK ((user_id = auth.uid()) OR is_team_owner() OR can_access_team_member(team_member_name));

CREATE POLICY "Team members can update sheets connections"
ON public.sheets_connections
FOR UPDATE
USING ((user_id = auth.uid()) OR is_team_owner() OR can_access_team_member(team_member_name));

CREATE POLICY "Team members can delete sheets connections"
ON public.sheets_connections
FOR DELETE
USING ((user_id = auth.uid()) OR is_team_owner() OR can_access_team_member(team_member_name));

-- Add updated_at trigger
CREATE TRIGGER update_sheets_connections_updated_at
BEFORE UPDATE ON public.sheets_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();