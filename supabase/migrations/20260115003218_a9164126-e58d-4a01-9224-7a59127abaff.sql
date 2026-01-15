-- Create lead_responses table to store questionnaire answers
CREATE TABLE public.lead_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  business_type TEXT,
  funding_amount TEXT,
  funding_timeline TEXT,
  annual_revenue TEXT,
  funding_purpose TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add questionnaire tracking columns to leads table
ALTER TABLE public.leads
ADD COLUMN questionnaire_token TEXT UNIQUE,
ADD COLUMN questionnaire_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN questionnaire_completed_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on lead_responses
ALTER TABLE public.lead_responses ENABLE ROW LEVEL SECURITY;

-- Admins can manage all lead responses
CREATE POLICY "Admins can manage lead responses"
ON public.lead_responses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can insert responses with valid token (for questionnaire submission)
CREATE POLICY "Public can insert responses with valid token"
ON public.lead_responses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_responses.lead_id
    AND leads.questionnaire_token IS NOT NULL
    AND leads.questionnaire_completed_at IS NULL
  )
);

-- Create index for faster token lookups
CREATE INDEX idx_leads_questionnaire_token ON public.leads(questionnaire_token) WHERE questionnaire_token IS NOT NULL;