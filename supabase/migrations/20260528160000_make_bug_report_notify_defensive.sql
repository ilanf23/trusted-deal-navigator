-- Harden the bug-report notification trigger.
--
-- A bug report must ALWAYS save, even if the notification fan-out fails for any
-- reason (constraint, RLS, schema drift, etc.). The original function let any
-- error in the notifications INSERT propagate and roll back the whole bug_reports
-- INSERT, surfacing as "Failed to submit bug report" in the UI. Wrap the fan-out
-- in an exception handler so notification problems degrade gracefully (logged as
-- a warning) instead of blocking the core write.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_super_admins_of_bug_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- Never block the bug report from saving on a notification failure.
    RAISE WARNING 'notify_super_admins_of_bug_report failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMIT;
