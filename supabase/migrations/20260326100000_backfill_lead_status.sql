-- Phase 4 (cont): Migrate leads from employee-named statuses to generic ones
-- This must run AFTER the enum ADD VALUE migration (separate transaction required)

UPDATE public.leads
SET status = 'need_structure'
WHERE status = 'need_structure_from_brad';

UPDATE public.leads
SET status = 'underwriting_review'
WHERE status = 'maura_underwriting';

UPDATE public.leads
SET status = 'senior_underwriting'
WHERE status = 'brad_underwriting';
