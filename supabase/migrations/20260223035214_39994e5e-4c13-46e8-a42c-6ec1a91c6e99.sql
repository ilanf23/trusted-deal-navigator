
-- Create team_monthly_goals table
CREATE TABLE public.team_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_name text NOT NULL,
  goal_label text NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  target_value integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_monthly_goals ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage team monthly goals"
  ON public.team_monthly_goals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_team_monthly_goals_updated_at
  BEFORE UPDATE ON public.team_monthly_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
