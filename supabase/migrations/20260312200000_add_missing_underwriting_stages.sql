-- ============================================================
-- Migration: Add missing Underwriting pipeline stages
-- ============================================================
-- The Underwriting pipeline was seeded with only 3 stages:
--   0: Review Kill / Keep
--   1: Initial Review
--   2: Waiting Needs List Items
--
-- The UI expects 10 stages. This migration:
--   1. Renames "Waiting Needs List Items" → "Waiting on Needs List"
--   2. Adds the 7 missing stages at the correct positions
-- ============================================================

DO $$
DECLARE
  v_uw_pipeline_id uuid;
BEGIN
  -- Find the Underwriting pipeline
  SELECT id INTO v_uw_pipeline_id
  FROM public.pipelines
  WHERE name = 'Underwriting' AND is_system = true
  LIMIT 1;

  IF v_uw_pipeline_id IS NULL THEN
    RAISE NOTICE 'Underwriting pipeline not found — skipping';
    RETURN;
  END IF;

  -- Rename "Waiting Needs List Items" → "Waiting on Needs List"
  UPDATE public.pipeline_stages
  SET name = 'Waiting on Needs List'
  WHERE pipeline_id = v_uw_pipeline_id
    AND name = 'Waiting Needs List Items';

  -- Re-position existing stages to make room
  -- Review Kill / Keep → position 0 (unchanged)
  -- Initial Review → position 1 (unchanged)
  -- Waiting on Needs List → position 2 (unchanged)

  -- Insert the 7 missing stages
  INSERT INTO public.pipeline_stages (pipeline_id, name, position)
  VALUES
    (v_uw_pipeline_id, 'Waiting on Client', 3),
    (v_uw_pipeline_id, 'Complete Files for Review', 4),
    (v_uw_pipeline_id, 'Need Structure from Brad', 5),
    (v_uw_pipeline_id, 'Maura Underwriting', 6),
    (v_uw_pipeline_id, 'Brad Underwriting', 7),
    (v_uw_pipeline_id, 'UW Paused', 8),
    (v_uw_pipeline_id, 'Ready for WU Approval', 9)
  ON CONFLICT DO NOTHING;

END $$;
