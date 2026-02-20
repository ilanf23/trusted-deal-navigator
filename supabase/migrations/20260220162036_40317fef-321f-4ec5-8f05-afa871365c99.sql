
-- =================================================================
-- Pipeline Overhaul Step 1: Add enum values, new columns, new tables
-- (Data migration will happen separately via INSERT tool)
-- =================================================================

-- 1. Add new enum values to lead_status
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'initial_review';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'moving_to_underwriting';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'onboarding';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ready_for_wu_approval';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'pre_approval_issued';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'won';

-- 2. Add new columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cohort_year integer,
  ADD COLUMN IF NOT EXISTS flagged_for_weekly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uw_number text,
  ADD COLUMN IF NOT EXISTS client_other_lenders boolean NOT NULL DEFAULT false;

-- 3. Create deal_milestones table
CREATE TABLE IF NOT EXISTS public.deal_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  milestone_name text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_by text,
  completed_at timestamp with time zone,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage deal milestones"
  ON public.deal_milestones FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_deal_milestones_lead_id ON public.deal_milestones(lead_id);

-- 4. Create deal_waiting_on table (structured tracking with history)
CREATE TABLE IF NOT EXISTS public.deal_waiting_on (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner text NOT NULL,
  description text,
  due_date timestamp with time zone,
  resolved_at timestamp with time zone,
  resolved_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_waiting_on ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage deal waiting on"
  ON public.deal_waiting_on FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_deal_waiting_on_lead_id ON public.deal_waiting_on(lead_id);
CREATE INDEX idx_deal_waiting_on_active ON public.deal_waiting_on(lead_id) WHERE resolved_at IS NULL;

-- 5. Add triggers for updated_at
CREATE TRIGGER update_deal_milestones_updated_at
  BEFORE UPDATE ON public.deal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_waiting_on_updated_at
  BEFORE UPDATE ON public.deal_waiting_on
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
