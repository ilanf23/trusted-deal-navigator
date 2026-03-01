
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  phone TEXT,
  contact_name TEXT,
  tasks_count INTEGER NOT NULL DEFAULT 0,
  website TEXT,
  contact_type TEXT DEFAULT 'prospect',
  email_domain TEXT,
  last_contacted TIMESTAMP WITH TIME ZONE,
  interactions_count INTEGER NOT NULL DEFAULT 0,
  inactive_days INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage companies"
  ON public.companies
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
