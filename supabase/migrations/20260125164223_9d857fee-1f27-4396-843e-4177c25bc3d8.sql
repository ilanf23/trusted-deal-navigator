-- Create a table for RateWatch Concierge questionnaire responses
CREATE TABLE public.ratewatch_questionnaire_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  
  -- Contact Information
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  contact_method TEXT,
  
  -- Current Loan Details
  current_lender TEXT,
  loan_balance NUMERIC,
  current_rate NUMERIC,
  target_rate NUMERIC,
  loan_maturity DATE,
  loan_type TEXT,
  rate_type TEXT,
  variable_index_spread TEXT,
  original_term_years NUMERIC,
  amortization TEXT,
  prepayment_penalty TEXT,
  lender_type TEXT,
  
  -- Collateral/Property Details
  collateral_type TEXT,
  collateral_value NUMERIC,
  re_city_state TEXT,
  property_occupancy TEXT,
  owner_occupied_pct NUMERIC,
  
  -- Business/Cash Flow
  estimated_cash_flow NUMERIC,
  business_description TEXT,
  
  -- Goals
  seeking_to_improve TEXT,
  additional_notes TEXT,
  
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add ratewatch_questionnaire fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS ratewatch_questionnaire_token UUID UNIQUE,
ADD COLUMN IF NOT EXISTS ratewatch_questionnaire_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ratewatch_questionnaire_completed_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.ratewatch_questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for questionnaire submissions (token-based access)
CREATE POLICY "Allow anonymous questionnaire submissions" 
ON public.ratewatch_questionnaire_responses 
FOR INSERT 
WITH CHECK (true);

-- Allow reading for authenticated admins
CREATE POLICY "Admins can read all ratewatch responses" 
ON public.ratewatch_questionnaire_responses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create index for faster lookups
CREATE INDEX idx_ratewatch_responses_lead_id ON public.ratewatch_questionnaire_responses(lead_id);

-- Add policies for public access via token (similar to existing questionnaire)
CREATE POLICY "Public can read lead by ratewatch questionnaire token" 
ON public.leads 
FOR SELECT 
USING (
  ratewatch_questionnaire_token IS NOT NULL 
  AND ratewatch_questionnaire_completed_at IS NULL
);

CREATE POLICY "Public can mark ratewatch questionnaire completed" 
ON public.leads 
FOR UPDATE 
USING (
  ratewatch_questionnaire_token IS NOT NULL 
  AND ratewatch_questionnaire_completed_at IS NULL
)
WITH CHECK (
  ratewatch_questionnaire_token IS NOT NULL
);