
-- Fix security definer views by setting them to SECURITY INVOKER
ALTER VIEW public.v_pipeline_metrics SET (security_invoker = on);
ALTER VIEW public.v_team_performance SET (security_invoker = on);
ALTER VIEW public.v_referral_analytics SET (security_invoker = on);
