ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS opportunity_name text NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS description text NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clx_file_name text NULL;
