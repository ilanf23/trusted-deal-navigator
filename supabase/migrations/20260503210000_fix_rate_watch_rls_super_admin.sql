-- Fix RLS on rate_watch so super_admin role can read/write entries.
-- Previously the policy only allowed `admin`, locking out super_admins
-- (which is the role founders use). Convention used elsewhere in the
-- schema (tasks, appointments, communications, etc.) is to OR both roles.

DROP POLICY IF EXISTS "Admins can manage rate watch" ON public.rate_watch;

CREATE POLICY "Admins can manage rate watch"
  ON public.rate_watch
  FOR ALL
  TO public
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
