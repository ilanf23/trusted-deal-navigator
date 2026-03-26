-- Phase 4: Add generic lead_status enum values to replace employee-named ones
-- Note: Postgres cannot remove enum values, so old values remain as dead code

ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'need_structure';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'underwriting_review';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'senior_underwriting';
