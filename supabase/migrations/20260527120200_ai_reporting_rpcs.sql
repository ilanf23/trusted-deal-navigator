-- 20260527120200_ai_reporting_rpcs.sql
-- Reporting RPCs. SECURITY INVOKER so the underlying RLS on potential /
-- underwriting / lender_management / invoices / revenue_targets applies to
-- the caller. The view + function from the previous two migrations do the
-- per-row filtering; these RPCs just shape the aggregate.

BEGIN;

-- Pipeline value, optionally narrowed by pipeline name or assignee.
CREATE OR REPLACE FUNCTION public.get_pipeline_value(
  p_pipeline text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL
)
RETURNS TABLE (
  pipeline text,
  open_count bigint,
  total_value numeric,
  total_expected_revenue numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    d.pipeline,
    count(*)::bigint AS open_count,
    COALESCE(sum(d.deal_value), 0) AS total_value,
    COALESCE(sum(public.compute_deal_revenue(d.potential_revenue, d.deal_value, d.fee_percent)), 0) AS total_expected_revenue
  FROM public.deals_v d
  WHERE (p_pipeline IS NULL OR d.pipeline = p_pipeline)
    AND (p_assigned_to IS NULL OR d.assigned_to = p_assigned_to)
    AND d.deal_outcome = 'open'
  GROUP BY d.pipeline;
$$;

-- Funded (won) deals in a window.
CREATE OR REPLACE FUNCTION public.get_funded_deals_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_assigned_to uuid DEFAULT NULL
)
RETURNS TABLE (
  funded_count bigint,
  total_loan_value numeric,
  total_actual_net_revenue numeric,
  total_expected_revenue numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    count(*)::bigint AS funded_count,
    COALESCE(sum(d.deal_value), 0) AS total_loan_value,
    COALESCE(sum(d.actual_net_revenue), 0) AS total_actual_net_revenue,
    COALESCE(sum(public.compute_deal_revenue(d.potential_revenue, d.deal_value, d.fee_percent)), 0) AS total_expected_revenue
  FROM public.deals_v d
  WHERE d.deal_outcome = 'won'
    AND d.won_at >= p_from
    AND d.won_at <  p_to
    AND (p_assigned_to IS NULL OR d.assigned_to = p_assigned_to);
$$;

-- Revenue vs target. Global only — revenue_targets has no per-user dimension today.
CREATE OR REPLACE FUNCTION public.get_revenue_vs_target(
  p_period_type text
)
RETURNS TABLE (
  period_type text,
  target_amount numeric,
  actual_amount numeric,
  pace_vs_plan integer,
  forecast_amount numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    rt.period_type,
    rt.target_amount,
    rt.current_amount AS actual_amount,
    rt.pace_vs_plan,
    rt.forecast_amount
  FROM public.revenue_targets rt
  WHERE rt.period_type = p_period_type
  ORDER BY rt.updated_at DESC
  LIMIT 1;
$$;

-- Invoice summary.
CREATE OR REPLACE FUNCTION public.get_invoice_summary(
  p_status text DEFAULT NULL,
  p_overdue_only boolean DEFAULT false,
  p_min_amount numeric DEFAULT NULL
)
RETURNS TABLE (
  invoice_count bigint,
  total_amount numeric,
  overdue_count bigint,
  overdue_amount numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    count(*)::bigint AS invoice_count,
    COALESCE(sum(amount), 0) AS total_amount,
    count(*) FILTER (WHERE due_date < CURRENT_DATE AND paid_at IS NULL)::bigint AS overdue_count,
    COALESCE(sum(amount) FILTER (WHERE due_date < CURRENT_DATE AND paid_at IS NULL), 0) AS overdue_amount
  FROM public.invoices
  WHERE (p_status IS NULL OR status::text = p_status)
    AND (p_min_amount IS NULL OR amount >= p_min_amount)
    AND (NOT p_overdue_only OR (due_date < CURRENT_DATE AND paid_at IS NULL));
$$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_value(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_funded_deals_summary(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_vs_target(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_summary(text, boolean, numeric) TO authenticated;

COMMIT;
