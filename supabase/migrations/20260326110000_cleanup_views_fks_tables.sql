-- Phase 5a: Drop unused evan_* views (zero frontend references confirmed)
DROP VIEW IF EXISTS public.evan_tasks;
DROP VIEW IF EXISTS public.evan_communications;
DROP VIEW IF EXISTS public.evan_appointments;
DROP VIEW IF EXISTS public.evan_notes;
DROP VIEW IF EXISTS public.evan_task_activities;
DROP VIEW IF EXISTS public.evan_task_files;

-- Phase 5b: Add FK constraints to contracts and invoices
-- Pre-check: any orphan rows will cause this to fail — run SELECT first
-- SELECT client_id FROM contracts WHERE client_id NOT IN (SELECT id FROM auth.users);
-- SELECT client_id FROM invoices WHERE client_id NOT IN (SELECT id FROM auth.users);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contracts_client_id_fkey'
    AND table_name = 'contracts'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_client_id_fkey'
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES auth.users(id);
  END IF;
END $$;

-- Phase 5c: Drop empty/unused tables (0 rows, no frontend references)
DROP TABLE IF EXISTS public.lead_companies CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
