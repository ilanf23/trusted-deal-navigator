-- Remove the Module Tracker feature entirely.
-- Drops business_requirements, module_tasks, and modules tables (plus their
-- RLS policies and triggers, which are removed automatically with the tables),
-- and the modules-specific updated_at trigger function.
-- The shared public.update_updated_at_column() function is intentionally left
-- in place because other tables still depend on it.

DROP TABLE IF EXISTS public.business_requirements CASCADE;
DROP TABLE IF EXISTS public.module_tasks CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;

DROP FUNCTION IF EXISTS public.update_modules_updated_at();
