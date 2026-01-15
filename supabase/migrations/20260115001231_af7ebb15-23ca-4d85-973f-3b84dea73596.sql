-- First, update all existing leads to 'new' before changing enum
UPDATE public.leads SET status = 'new';

-- Drop the old enum and create new one matching the proven process
ALTER TYPE public.lead_status RENAME TO lead_status_old;

CREATE TYPE public.lead_status AS ENUM (
  'discovery',
  'pre_qualification', 
  'document_collection',
  'underwriting',
  'approval',
  'funded'
);

-- Update the leads table to use new enum with default
ALTER TABLE public.leads 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.lead_status USING 'discovery'::public.lead_status,
  ALTER COLUMN status SET DEFAULT 'discovery'::public.lead_status;

-- Drop old enum
DROP TYPE public.lead_status_old;