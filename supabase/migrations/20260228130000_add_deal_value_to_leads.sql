-- Add deal_value column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deal_value numeric NULL;
