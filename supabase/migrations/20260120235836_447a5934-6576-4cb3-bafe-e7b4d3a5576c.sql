-- Add lead_id column to evan_tasks to link tasks to customers
ALTER TABLE public.evan_tasks 
ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_evan_tasks_lead_id ON public.evan_tasks(lead_id);