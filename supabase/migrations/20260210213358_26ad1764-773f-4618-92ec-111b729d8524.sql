
-- Create team_funded_deals table to track funded deals and commissions per team member
CREATE TABLE public.team_funded_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_name TEXT NOT NULL,
  loan_amount NUMERIC NOT NULL DEFAULT 0,
  fee_earned NUMERIC NOT NULL DEFAULT 0,
  days_in_pipeline INTEGER NOT NULL DEFAULT 0,
  funded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lead_id UUID REFERENCES public.leads(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_funded_deals ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage all funded deals"
ON public.team_funded_deals
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_team_funded_deals_updated_at
BEFORE UPDATE ON public.team_funded_deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
