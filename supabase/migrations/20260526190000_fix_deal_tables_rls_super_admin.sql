-- Fix RLS on deal tables (potential / underwriting / lender_management).
-- The legacy "Admins can manage leads" policy (from public.leads before the
-- leads -> pipeline -> potential renames) only matches app_role = 'admin'.
-- has_role() does an exact-string match, so super_admins (Ilan, Brad, Adam)
-- silently fail RLS on INSERT/UPDATE/DELETE. New opportunities flash on
-- screen via optimistic UI, then vanish when the refetch shows no row.
--
-- This mirrors the pattern already used for tasks/appointments/communications
-- in 20260407100001_workspace_per_user_rls.sql: a single FOR ALL policy that
-- accepts either role.

BEGIN;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop the legacy admin-only policy (carried over from public.leads via
    -- two table renames). Name varies by historical path, so try both.
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage leads" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage pipeline" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %s" ON public.%I', tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "Admins and super admins can manage %1$s"
        ON public.%1$I FOR ALL
        USING (
          has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'super_admin'::app_role)
        )
        WITH CHECK (
          has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'super_admin'::app_role)
        )
    $f$, tbl);
  END LOOP;
END $$;

COMMIT;
