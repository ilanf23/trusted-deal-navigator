
-- Create modules table
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  business_owner text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'in_review', 'complete', 'on_hold')),
  icon text DEFAULT 'Box',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create business_requirements table
CREATE TABLE public.business_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  requirement_id text NOT NULL,
  title text NOT NULL,
  description text,
  acceptance_criteria text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'implemented', 'verified')),
  assigned_to text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create module_tasks table (sub-tasks for progress tracking)
CREATE TABLE public.module_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin-only access
CREATE POLICY "Admins can manage modules"
  ON public.modules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage business requirements"
  ON public.business_requirements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage module tasks"
  ON public.module_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Timestamps trigger
CREATE OR REPLACE FUNCTION public.update_modules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_modules_updated_at();

CREATE TRIGGER update_br_updated_at
  BEFORE UPDATE ON public.business_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
