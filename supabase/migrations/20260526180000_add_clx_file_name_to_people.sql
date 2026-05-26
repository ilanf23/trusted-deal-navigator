-- Restore missing CRM fields on people that drifted from 20260320120000_add_people_crm_fields.sql.
-- That earlier migration is recorded as applied, but the columns are absent on remote.
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS clx_file_name text;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS bank_relationships text;
