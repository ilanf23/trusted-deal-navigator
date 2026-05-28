-- Make bug reports actually work end-to-end.
--
-- Two problems this migration fixes:
--
-- 1. RLS exact-match bug. The original "Admins can manage bug reports" policy
--    only matched app_role = 'admin'. has_role() is an exact-string match, so
--    super_admins (Ilan, Brad, Adam) silently fail RLS — they can neither read
--    nor manage bug reports, so the bug list renders empty for them. This is the
--    same class of bug fixed for the deal tables in
--    20260526190000_fix_deal_tables_rls_super_admin.sql.
--
-- 2. No notification on submit. Bug submissions were a plain INSERT with nothing
--    alerting the team. We add an AFTER INSERT trigger that fans out a 'system'
--    notification to every super_admin so they're alerted the moment a bug lands.

BEGIN;

-- ── 1. Fix RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Drop the legacy admin-only policy that excluded super_admins.
DROP POLICY IF EXISTS "Admins can manage bug reports" ON public.bug_reports;

-- Admins and super_admins can read + manage every bug report.
CREATE POLICY "Admins and super admins can manage bug reports"
  ON public.bug_reports FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Any authenticated user can submit a bug report (permissive, OR'd with the
-- manage policy above). Reading/updating still requires admin/super_admin.
CREATE POLICY "Authenticated users can submit bug reports"
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 2. Notify super_admins on new bug report ─────────────────────────────────

-- SECURITY DEFINER so the fan-out always succeeds regardless of who submitted
-- the bug (the submitter may not have rights to INSERT notifications for other
-- users). search_path pinned to public per project convention.
CREATE OR REPLACE FUNCTION public.notify_super_admins_of_bug_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, description, link_url)
  SELECT
    u.id,
    'system',
    'New bug report: ' || NEW.title,
    COALESCE(NULLIF(NEW.description, ''), 'Reported by ' || COALESCE(NEW.submitted_by, 'a team member')),
    '/superadmin/ilan/bugs'
  FROM public.users u
  WHERE u.app_role = 'super_admin'::app_role
    AND u.is_active = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bug_report_notify_super_admins ON public.bug_reports;

CREATE TRIGGER bug_report_notify_super_admins
  AFTER INSERT ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_super_admins_of_bug_report();

COMMIT;
