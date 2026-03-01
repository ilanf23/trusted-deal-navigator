
-- Add missing 'notes' column to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add missing 'phone' column to people table  
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add missing 'assigned_to' column to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Add missing 'linkedin' column to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS linkedin TEXT;

-- Add missing 'source' column to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS source TEXT;

-- Add missing 'last_activity_at' column to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- Rename person_name to name to match the Person interface
ALTER TABLE public.people RENAME COLUMN person_name TO name;

-- Rename company to company_name to match the Person interface
ALTER TABLE public.people RENAME COLUMN company TO company_name;

-- Create people_activities table
CREATE TABLE public.people_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.people_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage people activities"
  ON public.people_activities
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create people_tasks table
CREATE TABLE public.people_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.people_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage people tasks"
  ON public.people_tasks
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add the missing lead_status enum values
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'review_kill_keep';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'waiting_on_needs_list';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'waiting_on_client';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'complete_files_for_review';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'need_structure_from_brad';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'maura_underwriting';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'brad_underwriting';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'uw_paused';
