-- Add team_member_id to active_calls for per-user workspace isolation
-- All other workspace tables (tasks, appointments, communications) already have this column

ALTER TABLE public.active_calls
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_active_calls_team_member_id
  ON public.active_calls(team_member_id);
