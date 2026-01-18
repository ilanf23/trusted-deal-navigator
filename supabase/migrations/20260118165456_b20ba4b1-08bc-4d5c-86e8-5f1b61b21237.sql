-- Create lender_programs table to store program data
CREATE TABLE public.lender_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lender_name TEXT NOT NULL,
  lender_specialty TEXT,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL, -- SBA, Conventional, Bridge, Construction, CMBS
  description TEXT,
  min_loan NUMERIC,
  max_loan NUMERIC,
  interest_range TEXT,
  term TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for leads and lender programs
CREATE TABLE public.lead_lender_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.lender_programs(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT DEFAULT 'pending', -- pending, submitted, approved, declined
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, program_id)
);

-- Enable RLS
ALTER TABLE public.lender_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_lender_programs ENABLE ROW LEVEL SECURITY;

-- RLS policies for lender_programs (read-only for all admins, managed by admins)
CREATE POLICY "Admins can manage lender programs"
ON public.lender_programs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for lead_lender_programs
CREATE POLICY "Admins can manage lead lender programs"
ON public.lead_lender_programs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better query performance
CREATE INDEX idx_lead_lender_programs_lead_id ON public.lead_lender_programs(lead_id);
CREATE INDEX idx_lead_lender_programs_program_id ON public.lead_lender_programs(program_id);
CREATE INDEX idx_lender_programs_lender_name ON public.lender_programs(lender_name);
CREATE INDEX idx_lender_programs_program_type ON public.lender_programs(program_type);

-- Add trigger for updated_at
CREATE TRIGGER update_lender_programs_updated_at
BEFORE UPDATE ON public.lender_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_lender_programs_updated_at
BEFORE UPDATE ON public.lead_lender_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();