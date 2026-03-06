CREATE TABLE public.new_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT,
  company_name TEXT,
  source TEXT,
  signed_up_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.new_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage new signups"
  ON public.new_signups FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_new_signups_signed_up_at ON public.new_signups(signed_up_at DESC);
