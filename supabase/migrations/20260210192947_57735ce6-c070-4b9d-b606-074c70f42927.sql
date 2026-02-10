
-- Update RLS policies: remove partner self-access, keep admin/owner access
DROP POLICY IF EXISTS "Partners can view their own tracking" ON public.partner_tracking;
DROP POLICY IF EXISTS "Partners can create their own tracking" ON public.partner_tracking;
DROP POLICY IF EXISTS "Partners can update their own tracking" ON public.partner_tracking;
DROP POLICY IF EXISTS "Partners can delete their own tracking" ON public.partner_tracking;
DROP POLICY IF EXISTS "Admins have full access to tracking" ON public.partner_tracking;

-- Only owners/admins can access tracking
CREATE POLICY "Owners can view all tracking" ON public.partner_tracking FOR SELECT USING (public.is_team_owner());
CREATE POLICY "Owners can create tracking" ON public.partner_tracking FOR INSERT WITH CHECK (public.is_team_owner());
CREATE POLICY "Owners can update tracking" ON public.partner_tracking FOR UPDATE USING (public.is_team_owner());
CREATE POLICY "Owners can delete tracking" ON public.partner_tracking FOR DELETE USING (public.is_team_owner());
