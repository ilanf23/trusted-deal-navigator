-- Add operational fields to leads table for deal-level state
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS next_action TEXT,
ADD COLUMN IF NOT EXISTS waiting_on TEXT CHECK (waiting_on IN ('borrower', 'lender', 'internal', 'none')),
ADD COLUMN IF NOT EXISTS sla_threshold_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create email_threads table for thread-level tracking
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  subject TEXT,
  last_message_date TIMESTAMP WITH TIME ZONE,
  next_action TEXT,
  waiting_on TEXT CHECK (waiting_on IN ('borrower', 'lender', 'internal', 'none')),
  is_triaged BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  sla_breached BOOLEAN DEFAULT false,
  last_outbound_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on email_threads
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_threads
CREATE POLICY "Team members can view all email threads"
ON public.email_threads FOR SELECT
TO authenticated
USING (public.can_access_team_member('evan'));

CREATE POLICY "Team members can insert email threads"
ON public.email_threads FOR INSERT
TO authenticated
WITH CHECK (public.can_access_team_member('evan'));

CREATE POLICY "Team members can update email threads"
ON public.email_threads FOR UPDATE
TO authenticated
USING (public.can_access_team_member('evan'));

CREATE POLICY "Team members can delete email threads"
ON public.email_threads FOR DELETE
TO authenticated
USING (public.can_access_team_member('evan'));

-- Trigger for updated_at
CREATE TRIGGER update_email_threads_updated_at
BEFORE UPDATE ON public.email_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_threads_thread_id ON public.email_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_lead_id ON public.email_threads(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_is_triaged ON public.email_threads(is_triaged);