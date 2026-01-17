-- First drop the existing foreign key constraint on leads.assigned_to
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'Sales Rep',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Admins can manage team members
CREATE POLICY "Admins can manage team members"
ON public.team_members
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert Evan as default team member
INSERT INTO public.team_members (name, email, role) 
VALUES ('Evan', 'evan@company.com', 'Sales Lead');

-- Clear existing assigned_to values and update to Evan
UPDATE public.leads SET assigned_to = NULL;
UPDATE public.leads 
SET assigned_to = (SELECT id FROM public.team_members WHERE name = 'Evan' LIMIT 1);

-- Add foreign key to team_members
ALTER TABLE public.leads 
ADD CONSTRAINT leads_assigned_to_team_member_fkey 
FOREIGN KEY (assigned_to) REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();