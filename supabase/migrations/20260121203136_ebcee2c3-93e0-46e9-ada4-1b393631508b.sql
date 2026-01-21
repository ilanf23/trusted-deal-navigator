-- Create enum for column types
CREATE TYPE public.pipeline_column_type AS ENUM (
  'free_form',
  'date',
  'checkbox',
  'dropdown',
  'tag',
  'formula',
  'assigned_to',
  'contact'
);

-- Create pipeline_columns table for custom column definitions
CREATE TABLE public.pipeline_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  column_type pipeline_column_type NOT NULL DEFAULT 'free_form',
  position integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  is_frozen boolean NOT NULL DEFAULT false,
  -- For dropdown/tag types: stores the available options as JSON array
  options jsonb DEFAULT '[]'::jsonb,
  -- For formula type: stores the formula expression
  formula text,
  -- Additional settings (width, formatting, etc.)
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create pipeline_column_values table for storing lead-specific values
CREATE TABLE public.pipeline_column_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES public.pipeline_columns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  -- Value storage based on type
  text_value text,
  number_value numeric,
  date_value timestamptz,
  boolean_value boolean,
  -- For dropdown: single selected option
  dropdown_value text,
  -- For tag: array of selected tags
  tag_values text[],
  -- For assigned_to: team member id
  assigned_to_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  -- For contact: contact info JSON
  contact_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(column_id, lead_id)
);

-- Enable RLS
ALTER TABLE public.pipeline_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_column_values ENABLE ROW LEVEL SECURITY;

-- Pipeline columns policies
CREATE POLICY "Admins can manage all pipeline columns"
ON public.pipeline_columns FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Pipeline owners can manage columns"
ON public.pipeline_columns FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.pipelines p
  JOIN public.team_members tm ON tm.id = p.owner_id
  WHERE p.id = pipeline_columns.pipeline_id AND tm.user_id = auth.uid()
));

CREATE POLICY "Shared users can view columns"
ON public.pipeline_columns FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.pipelines p
  JOIN public.pipeline_shares ps ON ps.owner_id = p.owner_id
  JOIN public.team_members tm ON tm.id = ps.shared_with_id
  WHERE p.id = pipeline_columns.pipeline_id AND tm.user_id = auth.uid()
));

-- Pipeline column values policies
CREATE POLICY "Admins can manage all column values"
ON public.pipeline_column_values FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Pipeline owners can manage column values"
ON public.pipeline_column_values FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.pipeline_columns pc
  JOIN public.pipelines p ON p.id = pc.pipeline_id
  JOIN public.team_members tm ON tm.id = p.owner_id
  WHERE pc.id = pipeline_column_values.column_id AND tm.user_id = auth.uid()
));

CREATE POLICY "Shared users can view column values"
ON public.pipeline_column_values FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.pipeline_columns pc
  JOIN public.pipelines p ON p.id = pc.pipeline_id
  JOIN public.pipeline_shares ps ON ps.owner_id = p.owner_id
  JOIN public.team_members tm ON tm.id = ps.shared_with_id
  WHERE pc.id = pipeline_column_values.column_id AND tm.user_id = auth.uid()
));

CREATE POLICY "Shared users with edit access can manage column values"
ON public.pipeline_column_values FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.pipeline_columns pc
  JOIN public.pipelines p ON p.id = pc.pipeline_id
  JOIN public.pipeline_shares ps ON ps.owner_id = p.owner_id
  JOIN public.team_members tm ON tm.id = ps.shared_with_id
  WHERE pc.id = pipeline_column_values.column_id 
    AND tm.user_id = auth.uid() 
    AND ps.access_level = 'edit'
));

-- Create indexes for performance
CREATE INDEX idx_pipeline_columns_pipeline ON public.pipeline_columns(pipeline_id);
CREATE INDEX idx_pipeline_column_values_column ON public.pipeline_column_values(column_id);
CREATE INDEX idx_pipeline_column_values_lead ON public.pipeline_column_values(lead_id);

-- Add updated_at triggers
CREATE TRIGGER update_pipeline_columns_updated_at
  BEFORE UPDATE ON public.pipeline_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_column_values_updated_at
  BEFORE UPDATE ON public.pipeline_column_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();