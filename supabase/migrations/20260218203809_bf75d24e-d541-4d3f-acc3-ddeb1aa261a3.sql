
-- Add portal field to modules table
ALTER TABLE public.modules 
ADD COLUMN IF NOT EXISTS portal TEXT DEFAULT 'evan';

-- Add portal field to business_requirements table
ALTER TABLE public.business_requirements 
ADD COLUMN IF NOT EXISTS portal TEXT DEFAULT 'evan';

-- Backfill existing records as 'evan' portal
UPDATE public.modules SET portal = 'evan' WHERE portal IS NULL;
UPDATE public.business_requirements SET portal = 'evan' WHERE portal IS NULL;
