-- Create pipelines table for custom pipeline definitions
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#0066FF',
  icon text DEFAULT 'folder',
  is_main boolean DEFAULT false,
  template_type text, -- 'sales', 'referral', 'hot_deals', 'blank', null for custom
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create pipeline_stages table for customizable stages per pipeline
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#0066FF',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create pipeline_leads junction table (leads can exist in multiple pipelines)
CREATE TABLE public.pipeline_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, lead_id)
);

-- Enable RLS
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_leads ENABLE ROW LEVEL SECURITY;

-- Pipelines policies
CREATE POLICY "Admins can manage all pipelines"
ON public.pipelines FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can manage their own pipelines"
ON public.pipelines FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.id = pipelines.owner_id AND tm.user_id = auth.uid()
));

CREATE POLICY "Shared users can view pipelines"
ON public.pipelines FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.pipeline_shares ps
  JOIN public.team_members tm ON tm.id = ps.shared_with_id
  WHERE ps.owner_id = pipelines.owner_id AND tm.user_id = auth.uid()
));

-- Pipeline stages policies
CREATE POLICY "Admins can manage all pipeline stages"
ON public.pipeline_stages FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Pipeline owners can manage stages"
ON public.pipeline_stages FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.pipelines p
  JOIN public.team_members tm ON tm.id = p.owner_id
  WHERE p.id = pipeline_stages.pipeline_id AND tm.user_id = auth.uid()
));

CREATE POLICY "Shared users can view stages"
ON public.pipeline_stages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.pipelines p
  JOIN public.pipeline_shares ps ON ps.owner_id = p.owner_id
  JOIN public.team_members tm ON tm.id = ps.shared_with_id
  WHERE p.id = pipeline_stages.pipeline_id AND tm.user_id = auth.uid()
));

-- Pipeline leads policies
CREATE POLICY "Admins can manage all pipeline leads"
ON public.pipeline_leads FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Pipeline owners can manage pipeline leads"
ON public.pipeline_leads FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.pipelines p
  JOIN public.team_members tm ON tm.id = p.owner_id
  WHERE p.id = pipeline_leads.pipeline_id AND tm.user_id = auth.uid()
));

CREATE POLICY "Shared users can view pipeline leads"
ON public.pipeline_leads FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.pipelines p
  JOIN public.pipeline_shares ps ON ps.owner_id = p.owner_id
  JOIN public.team_members tm ON tm.id = ps.shared_with_id
  WHERE p.id = pipeline_leads.pipeline_id AND tm.user_id = auth.uid()
));

CREATE POLICY "Shared users with edit access can manage pipeline leads"
ON public.pipeline_leads FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.pipelines p
  JOIN public.pipeline_shares ps ON ps.owner_id = p.owner_id
  JOIN public.team_members tm ON tm.id = ps.shared_with_id
  WHERE p.id = pipeline_leads.pipeline_id 
    AND tm.user_id = auth.uid() 
    AND ps.access_level = 'edit'
));

-- Create indexes for performance
CREATE INDEX idx_pipelines_owner ON public.pipelines(owner_id);
CREATE INDEX idx_pipeline_stages_pipeline ON public.pipeline_stages(pipeline_id);
CREATE INDEX idx_pipeline_leads_pipeline ON public.pipeline_leads(pipeline_id);
CREATE INDEX idx_pipeline_leads_lead ON public.pipeline_leads(lead_id);
CREATE INDEX idx_pipeline_leads_stage ON public.pipeline_leads(stage_id);

-- Add updated_at triggers
CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_leads_updated_at
  BEFORE UPDATE ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();