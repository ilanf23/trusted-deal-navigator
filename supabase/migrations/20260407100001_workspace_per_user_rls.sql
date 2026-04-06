-- Per-user workspace isolation: tighten RLS policies on workspace tables
-- so each user only sees their own data (SELECT), while super_admins can see all.
-- INSERT/UPDATE/DELETE remain open to any admin/super_admin.

-- Helper: get current user's team member ID from the users table
CREATE OR REPLACE FUNCTION public.current_team_member_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 1. tasks
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage evan tasks" ON public.tasks;

-- SELECT: own data, super_admin sees all, NULL team_member_id visible (legacy)
CREATE POLICY "Users see own tasks"
  ON public.tasks FOR SELECT
  USING (
    team_member_id = current_team_member_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR team_member_id IS NULL
  );

-- INSERT/UPDATE/DELETE: any admin or super_admin
CREATE POLICY "Admins can write tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================================
-- 2. appointments
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage evan appointments" ON public.appointments;

CREATE POLICY "Users see own appointments"
  ON public.appointments FOR SELECT
  USING (
    team_member_id = current_team_member_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR team_member_id IS NULL
  );

CREATE POLICY "Admins can write appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can update appointments"
  ON public.appointments FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================================
-- 3. communications
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage evan communications" ON public.communications;

CREATE POLICY "Users see own communications"
  ON public.communications FOR SELECT
  USING (
    team_member_id = current_team_member_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR team_member_id IS NULL
  );

CREATE POLICY "Admins can write communications"
  ON public.communications FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can update communications"
  ON public.communications FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can delete communications"
  ON public.communications FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================================
-- 4. active_calls
-- ============================================================
DROP POLICY IF EXISTS "Admins can update active calls" ON public.active_calls;
DROP POLICY IF EXISTS "Admins can view all active calls" ON public.active_calls;
DROP POLICY IF EXISTS "Admins can manage active calls" ON public.active_calls;

CREATE POLICY "Users see own active calls"
  ON public.active_calls FOR SELECT
  USING (
    team_member_id = current_team_member_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR team_member_id IS NULL
  );

CREATE POLICY "Admins can write active calls"
  ON public.active_calls FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can update active calls"
  ON public.active_calls FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can delete active calls"
  ON public.active_calls FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
