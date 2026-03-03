
-- 1. activity_comments — used by Pipeline, Underwriting, Company, People expanded views
CREATE TABLE public.activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  content text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage activity comments" ON public.activity_comments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. company_activities — used by CompanyExpandedView
CREATE TABLE public.company_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title text,
  content text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage company activities" ON public.company_activities FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. people_files — used by PeopleExpandedView
CREATE TABLE public.people_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.people_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage people files" ON public.people_files FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
