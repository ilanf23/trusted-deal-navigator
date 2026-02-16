
-- ============================================
-- 1. Revenue Targets
-- ============================================
CREATE TABLE public.revenue_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  forecast_amount NUMERIC NOT NULL DEFAULT 0,
  forecast_confidence INTEGER NOT NULL DEFAULT 0,
  pace_vs_plan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage revenue targets" ON public.revenue_targets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 2. Dashboard Deals (pipeline deals)
-- ============================================
CREATE TABLE public.dashboard_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage TEXT NOT NULL,
  deal_name TEXT,
  requested_amount NUMERIC NOT NULL DEFAULT 0,
  weighted_fees NUMERIC NOT NULL DEFAULT 0,
  owner_name TEXT,
  days_in_stage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.dashboard_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage dashboard deals" ON public.dashboard_deals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 3. Dashboard Referral Sources
-- ============================================
CREATE TABLE public.dashboard_referral_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  last_contact_days_ago INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_referral_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage dashboard referral sources" ON public.dashboard_referral_sources FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 4. Dashboard Weekly Scorecard
-- ============================================
CREATE TABLE public.dashboard_weekly_scorecard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_label TEXT NOT NULL,
  metric_value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  color_class TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_weekly_scorecard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage dashboard weekly scorecard" ON public.dashboard_weekly_scorecard FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 5. Views
-- ============================================
CREATE OR REPLACE VIEW public.v_pipeline_metrics AS
SELECT 
  stage,
  COUNT(*)::INTEGER as deal_count,
  SUM(requested_amount) as total_requested,
  SUM(weighted_fees) as total_weighted_fees,
  COALESCE(ROUND(AVG(days_in_stage)), 0)::INTEGER as median_days
FROM public.dashboard_deals
GROUP BY stage
ORDER BY CASE stage
  WHEN 'Initial Consult' THEN 1
  WHEN 'Onboarding' THEN 2
  WHEN 'In-House Underwriting' THEN 3
  WHEN 'Lender Management' THEN 4
  WHEN 'Path to Close' THEN 5
  WHEN 'Closed' THEN 6
  ELSE 7
END;

CREATE OR REPLACE VIEW public.v_team_performance AS
SELECT 
  owner_name as name,
  COUNT(*) FILTER (WHERE stage != 'Closed')::INTEGER as active_deals,
  COALESCE(ROUND(AVG(days_in_stage) FILTER (WHERE stage != 'Closed')), 0)::INTEGER as avg_days,
  COUNT(*) FILTER (WHERE stage = 'Closed')::INTEGER as closings,
  CASE 
    WHEN COUNT(*) > 0 
    THEN ROUND(COUNT(*) FILTER (WHERE stage = 'Closed')::NUMERIC / COUNT(*) * 100)::INTEGER
    ELSE 0
  END as conversion
FROM public.dashboard_deals
WHERE owner_name IS NOT NULL
GROUP BY owner_name;

CREATE OR REPLACE VIEW public.v_referral_analytics AS
SELECT 
  name,
  total_revenue,
  status,
  last_contact_days_ago
FROM public.dashboard_referral_sources
ORDER BY total_revenue DESC;

-- ============================================
-- 6. Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.revenue_targets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_referral_sources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_weekly_scorecard;

-- ============================================
-- 7. Seed Data
-- ============================================

-- Revenue targets
INSERT INTO public.revenue_targets (period_type, target_amount, current_amount, forecast_amount, forecast_confidence, pace_vs_plan) VALUES
('ytd', 1500000, 156000, 1110000, 74, 224),
('mtd', 125000, 24000, 98000, 81, 187);

-- Pipeline deals (42 deals across 6 stages)
INSERT INTO public.dashboard_deals (stage, deal_name, requested_amount, weighted_fees, owner_name, days_in_stage) VALUES
('Initial Consult', 'Riverside Plaza', 6800000, 7500, 'Brad', 8),
('Initial Consult', 'Harbor View Tower', 7200000, 8000, 'Adam', 10),
('Initial Consult', 'Elm Street Retail', 5900000, 6500, 'Brad', 7),
('Initial Consult', 'Summit Office Park', 8100000, 9000, 'Maura', 12),
('Initial Consult', 'Lakewood Commons', 6500000, 7200, 'Adam', 9),
('Initial Consult', 'Pine Ridge Medical', 7400000, 8200, 'Wendy', 8),
('Initial Consult', 'Cedar Point Mall', 6300000, 7000, 'Brad', 11),
('Initial Consult', 'Valley Tech Center', 6500000, 7100, 'Evan', 9),
('Onboarding', 'Metro Square', 8200000, 18500, 'Brad', 6),
('Onboarding', 'Sunset Industrial', 7500000, 16800, 'Maura', 8),
('Onboarding', 'Beacon Hill Apts', 8100000, 18200, 'Adam', 5),
('Onboarding', 'Oakdale Warehouse', 7800000, 17500, 'Wendy', 9),
('Onboarding', 'Maple Grove Office', 7400000, 16600, 'Brad', 7),
('Onboarding', 'Crosstown Retail', 7800000, 17400, 'Evan', 8),
('In-House Underwriting', 'Grand Ave Hotel', 9200000, 28500, 'Adam', 7),
('In-House Underwriting', 'Parkway Plaza', 8800000, 27200, 'Maura', 9),
('In-House Underwriting', 'Ironworks Lofts', 9500000, 29400, 'Brad', 6),
('In-House Underwriting', 'Bayfront Marina', 8600000, 26600, 'Wendy', 10),
('In-House Underwriting', 'Northgate Center', 9100000, 28200, 'Adam', 8),
('In-House Underwriting', 'Willowbrook Med', 8400000, 26000, 'Maura', 7),
('In-House Underwriting', 'Highland Storage', 8800000, 27200, 'Evan', 9),
('Lender Management', 'Civic Tower', 8800000, 51000, 'Brad', 11),
('Lender Management', 'Harborside Mixed', 8200000, 47500, 'Adam', 9),
('Lender Management', 'Greenfield Campus', 8600000, 49800, 'Maura', 10),
('Lender Management', 'Riverside Condos', 8400000, 48700, 'Wendy', 12),
('Lender Management', 'Midtown Garage', 8400000, 52000, 'Brad', 8),
('Path to Close', 'Westfield Tower', 8500000, 89000, 'Adam', 13),
('Path to Close', 'Eastgate Retail', 8100000, 84500, 'Maura', 11),
('Path to Close', 'Southpark Office', 8200000, 86500, 'Brad', 14),
('Path to Close', 'Brookview Apts', 8000000, 88000, 'Wendy', 10),
('Closed', 'Cornerstone Plaza', 7800000, 72500, 'Brad', 0),
('Closed', 'Westlake Center', 8200000, 76000, 'Adam', 0),
('Closed', 'Meadowbrook Mall', 7500000, 69500, 'Maura', 0),
('Closed', 'Ashton Business Pk', 8100000, 75000, 'Wendy', 0),
('Closed', 'Pioneer Square', 7900000, 73200, 'Brad', 0),
('Closed', 'Gateway Commons', 8300000, 77000, 'Adam', 0),
('Closed', 'Bridgewater Office', 7600000, 70500, 'Maura', 0),
('Closed', 'Harbor Point Hotel', 8000000, 74200, 'Brad', 0),
('Closed', 'Creekside Retail', 7700000, 71400, 'Wendy', 0),
('Closed', 'Summit Ridge Plaza', 8400000, 78000, 'Adam', 0),
('Closed', 'Eastview Warehouse', 7200000, 66800, 'Evan', 0),
('Closed', 'Northfield Medical', 7500000, 67900, 'Maura', 0);

-- Referral sources
INSERT INTO public.dashboard_referral_sources (name, total_revenue, status, last_contact_days_ago) VALUES
('John Mitchell', 179000, 'Hot', 11),
('Susan Park', 175000, 'Dormant', 75),
('Thomas Greene', 168000, 'Warm', 17),
('Brian O''Connor', 149000, 'Dormant', 79),
('Angela Martinez', 138000, 'Cold', 52),
('David Chen', 132000, 'Hot', 5),
('Maria Santos', 126000, 'Warm', 22),
('Robert Kim', 118000, 'Cold', 45);

-- Weekly scorecard
INSERT INTO public.dashboard_weekly_scorecard (metric_label, metric_value, display_order, color_class) VALUES
('Consults Held', '0', 1, NULL),
('Onboarding Started', '4', 2, NULL),
('Docs Complete', '80%', 3, NULL),
('Packages Ready', '5', 4, NULL),
('Term Sheets', '7', 5, NULL),
('Commitments', '4', 6, NULL),
('Closings (30d)', '1', 7, NULL),
('Fees Booked', '$0', 8, 'text-muted-foreground'),
('Fees Collected', '$156K', 9, 'text-admin-teal');
