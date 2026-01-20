-- Add extended contact fields to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS known_as TEXT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'potential_customer',
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS about TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS linkedin TEXT,
ADD COLUMN IF NOT EXISTS twitter TEXT;

-- Create table for multiple phone numbers
CREATE TABLE public.lead_phones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  phone_type TEXT DEFAULT 'mobile', -- mobile, work, home, other
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for multiple email addresses
CREATE TABLE public.lead_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_type TEXT DEFAULT 'work', -- work, personal, other
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for multiple addresses
CREATE TABLE public.lead_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  address_type TEXT DEFAULT 'business', -- home, business
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'USA',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for other contact methods (social, etc)
CREATE TABLE public.lead_other_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL, -- facebook, instagram, skype, etc
  contact_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for connections/relationships between leads
CREATE TABLE public.lead_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  connected_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  connected_name TEXT, -- For external contacts not in leads table
  connected_company TEXT,
  relationship_type TEXT, -- colleague, spouse, referrer, attorney, etc
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for activity/history log
CREATE TABLE public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- phone_call, note, email, meeting, status_change
  title TEXT,
  content TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for lead tasks
CREATE TABLE public.lead_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  assigned_to UUID REFERENCES public.team_members(id),
  created_by TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.lead_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_other_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_phones
CREATE POLICY "Admins can manage lead phones" ON public.lead_phones
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for lead_emails
CREATE POLICY "Admins can manage lead emails" ON public.lead_emails
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for lead_addresses
CREATE POLICY "Admins can manage lead addresses" ON public.lead_addresses
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for lead_other_contacts
CREATE POLICY "Admins can manage lead other contacts" ON public.lead_other_contacts
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for lead_connections
CREATE POLICY "Admins can manage lead connections" ON public.lead_connections
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for lead_activities
CREATE POLICY "Admins can manage lead activities" ON public.lead_activities
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for lead_tasks
CREATE POLICY "Admins can manage lead tasks" ON public.lead_tasks
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add indexes for performance
CREATE INDEX idx_lead_phones_lead_id ON public.lead_phones(lead_id);
CREATE INDEX idx_lead_emails_lead_id ON public.lead_emails(lead_id);
CREATE INDEX idx_lead_addresses_lead_id ON public.lead_addresses(lead_id);
CREATE INDEX idx_lead_other_contacts_lead_id ON public.lead_other_contacts(lead_id);
CREATE INDEX idx_lead_connections_lead_id ON public.lead_connections(lead_id);
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_tasks_lead_id ON public.lead_tasks(lead_id);

-- Trigger for lead_tasks updated_at
CREATE TRIGGER update_lead_tasks_updated_at
BEFORE UPDATE ON public.lead_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();