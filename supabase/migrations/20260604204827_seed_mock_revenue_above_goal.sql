-- Seed mock won deals so YTD revenue lands just above the annual revenue goal.
--
-- Annual goal: $1,500,000 (revenue_targets has no 'annual' row, so the dashboard
-- falls back to the $1.5M default in useDashboardData.ts / the goal tracker).
-- This seeds 9 won deals across Jan–Jun 2026 totaling $1,555,000 (~3.7% over goal).
--
-- Two filters must be satisfied for this revenue to surface everywhere:
--  1. pipeline='potential' AND deal_outcome='won' — every dashboard revenue
--     consumer (useDashboardData fundedQuery, the annual goal banner, the company
--     revenue banner, and the RevenueChart) filters won deals this way.
--  2. assigned_to = a rep — the CLX Assistant scopes deal/revenue queries to the
--     current non-founder rep's assigned_to, so unassigned deals are invisible to
--     it. Attribute these to the demo rep so the assistant can report them.
--
-- Deals: status='won', deal_outcome='won', won=true, fee_percent=1.25, and
-- potential_revenue = deal_value * 1.25%.

INSERT INTO public.deals
  (name, company_name, pipeline, status, deal_outcome, won,
   deal_value, fee_percent, potential_revenue, won_at, won_reason, stage_id, assigned_to)
SELECT
  d.name, d.company_name, 'potential'::deal_pipeline, 'won'::lead_status,
  'won'::deal_outcome, true,
  d.deal_value, 1.25, d.deal_value * 1.25 / 100, d.won_at,
  'Best rate among 4 lenders; closed ahead of target',
  NULL::uuid,
  (SELECT id FROM public.users WHERE email = 'evan@commerciallendingx.com' LIMIT 1)
FROM (VALUES
  ('Harold Vance',     'Vance Logistics Group',       12800000::numeric, TIMESTAMPTZ '2026-01-16 15:00:00+00'),
  ('Priya Nair',       'Nair Manufacturing Co',       14400000::numeric, TIMESTAMPTZ '2026-02-10 15:00:00+00'),
  ('Marcus Bell',      'Bellwether Hospitality',       11200000::numeric, TIMESTAMPTZ '2026-03-04 15:00:00+00'),
  ('Sofia Reyes',      'Reyes Cold Storage',           16000000::numeric, TIMESTAMPTZ '2026-03-25 15:00:00+00'),
  ('Damon Walsh',      'Walsh Industrial Park',        13600000::numeric, TIMESTAMPTZ '2026-04-15 15:00:00+00'),
  ('Lena Petrov',      'Petrov Agriculture Holdings',  12000000::numeric, TIMESTAMPTZ '2026-04-29 15:00:00+00'),
  ('Theo Okafor',      'Okafor Medical Real Estate',   15200000::numeric, TIMESTAMPTZ '2026-05-28 15:00:00+00'),
  ('Grace Lambert',    'Lambert Self-Storage REIT',    12400000::numeric, TIMESTAMPTZ '2026-06-02 15:00:00+00'),
  ('Owen Castellano',  'Castellano Distribution Center', 16800000::numeric, TIMESTAMPTZ '2026-05-12 15:00:00+00')
) AS d(name, company_name, deal_value, won_at);
