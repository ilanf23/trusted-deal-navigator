
-- Add missing columns to leads table for UnderwritingExpandedView
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS opportunity_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clx_file_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS history TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bank_relationships TEXT;
