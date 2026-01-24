-- Create a table for storing multiple contacts per lead
CREATE TABLE public.lead_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for team member access
CREATE POLICY "Team members can view lead contacts"
ON public.lead_contacts
FOR SELECT
USING (true);

CREATE POLICY "Team members can create lead contacts"
ON public.lead_contacts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Team members can update lead contacts"
ON public.lead_contacts
FOR UPDATE
USING (true);

CREATE POLICY "Team members can delete lead contacts"
ON public.lead_contacts
FOR DELETE
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_lead_contacts_lead_id ON public.lead_contacts(lead_id);

-- Trigger for updated_at
CREATE TRIGGER update_lead_contacts_updated_at
BEFORE UPDATE ON public.lead_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();