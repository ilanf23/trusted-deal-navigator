-- 20260527120100_ai_reporting_revenue_fn.sql
-- Canonical revenue calc. Mirrors src/components/admin/dashboard/useDashboardData.ts
-- getDealRevenue(). Both dashboard SQL and AI reporting RPCs MUST call this.

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_deal_revenue(
  potential_revenue numeric,
  deal_value numeric,
  fee_percent numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN COALESCE(potential_revenue, 0) > 0
      THEN potential_revenue
    WHEN COALESCE(fee_percent, 0) > 0
      THEN COALESCE(deal_value, 0) * (fee_percent / 100.0)
    ELSE
      COALESCE(deal_value, 0) * 0.02
  END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_deal_revenue(numeric, numeric, numeric) TO authenticated;

COMMIT;
