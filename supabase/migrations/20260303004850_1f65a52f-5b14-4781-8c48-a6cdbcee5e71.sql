
-- 1. lead_checklists
CREATE TABLE public.lead_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title text DEFAULT 'Checklist',
  created_by text,
  activity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage lead checklists" ON public.lead_checklists FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. lead_checklist_items
CREATE TABLE public.lead_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.lead_checklists(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_checked boolean DEFAULT false,
  position integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage lead checklist items" ON public.lead_checklist_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. checklist_templates
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage checklist templates" ON public.checklist_templates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. checklist_template_items
CREATE TABLE public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  text text NOT NULL,
  position integer DEFAULT 0
);
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage checklist template items" ON public.checklist_template_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
