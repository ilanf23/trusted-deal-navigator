-- Rename the 'pipeline' deal table to 'potential' to accurately reflect the deal lifecycle:
-- Potential → Underwriting → Lender Management

BEGIN;

-- 1a. Rename deal table
ALTER TABLE public.pipeline RENAME TO potential;

-- 1b. Rename junction table
ALTER TABLE public.pipeline_people RENAME TO potential_people;

-- 1c. Rename FK column in junction table
ALTER TABLE public.potential_people RENAME COLUMN pipeline_id TO potential_id;

-- 1d. Add 'potential' to entity_type_enum
ALTER TYPE public.entity_type_enum ADD VALUE IF NOT EXISTS 'potential';

COMMIT;

-- Data migration: update all entity_type references from 'pipeline' to 'potential'
-- (Must be in a separate transaction after ADD VALUE)
BEGIN;

UPDATE public.activities SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.notes SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.communications SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.entity_contacts SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.entity_emails SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.entity_phones SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.entity_addresses SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.entity_files SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.entity_followers SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.entity_projects SET entity_type = 'potential' WHERE entity_type = 'pipeline';
UPDATE public.outbound_emails SET entity_type = 'potential' WHERE entity_type = 'pipeline';

COMMIT;
