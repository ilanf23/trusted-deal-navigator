
ALTER TABLE public.business_requirements
ADD COLUMN is_built boolean NOT NULL DEFAULT false;

UPDATE public.business_requirements SET is_built = true WHERE status = 'verified';
