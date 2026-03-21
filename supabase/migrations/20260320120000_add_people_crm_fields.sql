-- Add missing CRM fields to people table
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS known_as text;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS clx_file_name text;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS bank_relationships text;

-- People emails (mirrors lead_emails schema)
CREATE TABLE IF NOT EXISTS public.people_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  email_type text DEFAULT 'work',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- People phones (mirrors lead_phones schema)
CREATE TABLE IF NOT EXISTS public.people_phones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE NOT NULL,
  phone_number text NOT NULL,
  phone_type text DEFAULT 'work',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- People addresses (mirrors lead_addresses schema)
CREATE TABLE IF NOT EXISTS public.people_addresses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE NOT NULL,
  address_type text DEFAULT 'business',
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  zip_code text,
  country text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_people_emails_person_id ON public.people_emails(person_id);
CREATE INDEX IF NOT EXISTS idx_people_phones_person_id ON public.people_phones(person_id);
CREATE INDEX IF NOT EXISTS idx_people_addresses_person_id ON public.people_addresses(person_id);

-- RLS
ALTER TABLE public.people_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage people emails" ON public.people_emails
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage people phones" ON public.people_phones
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage people addresses" ON public.people_addresses
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
