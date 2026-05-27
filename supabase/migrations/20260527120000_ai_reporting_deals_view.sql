-- 20260527120000_ai_reporting_deals_view.sql
-- Unified read-only view across the three deal pipeline tables. Inherits the
-- caller's RLS automatically because views respect the underlying tables'
-- policies (no SECURITY DEFINER here).

BEGIN;

CREATE OR REPLACE VIEW public.deals_v AS
  SELECT
    id,
    'potential'::text         AS pipeline,
    name,
    company_name,
    status,
    stage_id,
    assigned_to,
    deal_outcome,
    priority,
    deal_value,
    fee_percent,
    potential_revenue,
    net_revenue,
    actual_net_revenue,
    invoice_amount,
    source,
    referral_source,
    won_at,
    lost_at,
    close_date,
    target_closing_date,
    created_at,
    updated_at
  FROM public.potential
  UNION ALL
  SELECT
    id, 'underwriting', name, company_name, status, stage_id, assigned_to,
    deal_outcome, priority, deal_value, fee_percent, potential_revenue,
    net_revenue, actual_net_revenue, invoice_amount, source, referral_source,
    won_at, lost_at, close_date, target_closing_date, created_at, updated_at
  FROM public.underwriting
  UNION ALL
  SELECT
    id, 'lender_management', name, company_name, status, stage_id, assigned_to,
    deal_outcome, priority, deal_value, fee_percent, potential_revenue,
    net_revenue, actual_net_revenue, invoice_amount, source, referral_source,
    won_at, lost_at, close_date, target_closing_date, created_at, updated_at
  FROM public.lender_management;

GRANT SELECT ON public.deals_v TO authenticated;

COMMIT;
