-- Lead checklists (one per deal)
CREATE TABLE public.lead_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Checklist',
  created_by TEXT,
  activity_id UUID REFERENCES public.lead_activities(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead checklists"
  ON public.lead_checklists FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_lead_checklists_lead_id ON public.lead_checklists(lead_id);
CREATE INDEX idx_lead_checklists_activity_id ON public.lead_checklists(activity_id);

-- Checklist items
CREATE TABLE public.lead_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.lead_checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead checklist items"
  ON public.lead_checklist_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_lead_checklist_items_checklist_id ON public.lead_checklist_items(checklist_id);

-- Reusable checklist templates
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage checklist templates"
  ON public.checklist_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Template items
CREATE TABLE public.checklist_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage checklist template items"
  ON public.checklist_template_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_checklist_template_items_template_id ON public.checklist_template_items(template_id);
