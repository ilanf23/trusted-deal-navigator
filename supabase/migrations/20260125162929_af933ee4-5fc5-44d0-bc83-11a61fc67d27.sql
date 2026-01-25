-- Add new columns to rate_watch table for comprehensive loan tracking
ALTER TABLE public.rate_watch
ADD COLUMN IF NOT EXISTS confirm_email boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS initial_review text,
ADD COLUMN IF NOT EXISTS collateral_type text,
ADD COLUMN IF NOT EXISTS collateral_value numeric,
ADD COLUMN IF NOT EXISTS loan_maturity date,
ADD COLUMN IF NOT EXISTS re_location text,
ADD COLUMN IF NOT EXISTS rate_type text,
ADD COLUMN IF NOT EXISTS variable_index_spread text,
ADD COLUMN IF NOT EXISTS original_term_years numeric,
ADD COLUMN IF NOT EXISTS amortization text,
ADD COLUMN IF NOT EXISTS penalty text,
ADD COLUMN IF NOT EXISTS lender_type text,
ADD COLUMN IF NOT EXISTS estimated_cf numeric,
ADD COLUMN IF NOT EXISTS occupancy_use text,
ADD COLUMN IF NOT EXISTS owner_occupied_pct numeric,
ADD COLUMN IF NOT EXISTS seeking_to_improve text;