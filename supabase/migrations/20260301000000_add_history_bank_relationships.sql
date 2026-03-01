ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS history text NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bank_relationships text NULL;
