
CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  tasks_count INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  contact_type TEXT DEFAULT 'prospect',
  last_contacted TIMESTAMP WITH TIME ZONE,
  interactions_count INTEGER NOT NULL DEFAULT 0,
  inactive_days INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage people"
  ON public.people
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
