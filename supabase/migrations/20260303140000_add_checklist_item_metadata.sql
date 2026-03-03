ALTER TABLE public.lead_checklist_items
  ADD COLUMN due_date date,
  ADD COLUMN assigned_to text;

ALTER TABLE public.checklist_template_items
  ADD COLUMN due_date date,
  ADD COLUMN assigned_to text;
