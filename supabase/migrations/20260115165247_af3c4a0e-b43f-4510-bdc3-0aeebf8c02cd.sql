-- Create a rate_watch table to track leads enrolled in rate watch program
CREATE TABLE public.rate_watch (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  current_rate DECIMAL(5,3) NOT NULL,
  target_rate DECIMAL(5,3) NOT NULL,
  loan_type TEXT,
  loan_amount NUMERIC,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Enable RLS
ALTER TABLE public.rate_watch ENABLE ROW LEVEL SECURITY;

-- Create policy for admins
CREATE POLICY "Admins can manage rate watch"
ON public.rate_watch
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_rate_watch_updated_at
BEFORE UPDATE ON public.rate_watch
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();