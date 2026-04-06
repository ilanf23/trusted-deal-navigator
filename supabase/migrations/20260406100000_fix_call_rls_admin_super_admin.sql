-- Fix RLS policies on call-related tables to allow BOTH admin AND super_admin access.
-- Previously, policies used has_role(auth.uid(), 'admin'::app_role) which only matched
-- the exact 'admin' role, locking out super_admin users from call features.

-- ============================================================
-- Step 1: Drop and recreate active_calls policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can update active calls" ON public.active_calls;
DROP POLICY IF EXISTS "Admins can view all active calls" ON public.active_calls;

CREATE POLICY "Admins can manage active calls"
  ON public.active_calls FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================================
-- Step 2: Drop and recreate call_events policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can read call events" ON public.call_events;

CREATE POLICY "Admins can read call events"
  ON public.call_events FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- ============================================================
-- Step 3: Fix evan_communications policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage evan communications" ON public.evan_communications;

CREATE POLICY "Admins can manage evan communications"
  ON public.evan_communications FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
