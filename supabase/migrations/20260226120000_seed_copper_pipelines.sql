-- ============================================================
-- Migration: Seed Copper CRM Pipelines + Stages + Backfill
-- ============================================================
-- Aligns the DB-driven pipeline model with Copper CRM's 3 pipelines
-- and 18 stages. Also backfills pipeline_leads from existing
-- leads.status values and creates a sync trigger.
-- ============================================================

-- Step 1: Add is_system column to pipelines
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Step 2: Seed pipelines and stages
DO $$
DECLARE
  v_owner_id uuid;
  v_potential_id uuid;
  v_underwriting_id uuid;
  v_lender_id uuid;
BEGIN
  -- Look up the first active owner from team_members
  SELECT id INTO v_owner_id
  FROM public.team_members
  WHERE role = 'owner' AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'No active owner found in team_members';
  END IF;

  -- -------------------------------------------------------
  -- Insert 3 pipelines
  -- -------------------------------------------------------
  INSERT INTO public.pipelines (id, name, is_main, is_system, owner_id)
  VALUES (gen_random_uuid(), 'Potential', true, true, v_owner_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_potential_id;

  -- If the pipeline already exists, look it up
  IF v_potential_id IS NULL THEN
    SELECT id INTO v_potential_id
    FROM public.pipelines
    WHERE name = 'Potential' AND is_system = true
    LIMIT 1;
  END IF;

  INSERT INTO public.pipelines (id, name, is_main, is_system, owner_id)
  VALUES (gen_random_uuid(), 'Underwriting', false, true, v_owner_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_underwriting_id;

  IF v_underwriting_id IS NULL THEN
    SELECT id INTO v_underwriting_id
    FROM public.pipelines
    WHERE name = 'Underwriting' AND is_system = true
    LIMIT 1;
  END IF;

  INSERT INTO public.pipelines (id, name, is_main, is_system, owner_id)
  VALUES (gen_random_uuid(), 'Lender Management', false, true, v_owner_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_lender_id;

  IF v_lender_id IS NULL THEN
    SELECT id INTO v_lender_id
    FROM public.pipelines
    WHERE name = 'Lender Management' AND is_system = true
    LIMIT 1;
  END IF;

  -- -------------------------------------------------------
  -- Insert stages for Potential pipeline (7 stages)
  -- -------------------------------------------------------
  INSERT INTO public.pipeline_stages (pipeline_id, name, position)
  VALUES
    (v_potential_id, 'Initial Contact', 0),
    (v_potential_id, 'Incoming - On Hold', 1),
    (v_potential_id, 'In Process - On Hold', 2),
    (v_potential_id, 'Waiting on Client to move forward', 3),
    (v_potential_id, 'Complete Files for Review', 4),
    (v_potential_id, 'Maura Underwriting', 5),
    (v_potential_id, 'Ready for WU Approval', 6)
  ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Insert stages for Underwriting pipeline (3 stages)
  -- -------------------------------------------------------
  INSERT INTO public.pipeline_stages (pipeline_id, name, position)
  VALUES
    (v_underwriting_id, 'Review Kill / Keep', 0),
    (v_underwriting_id, 'Initial Review', 1),
    (v_underwriting_id, 'Waiting Needs List Items', 2)
  ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Insert stages for Lender Management pipeline (8 stages)
  -- -------------------------------------------------------
  INSERT INTO public.pipeline_stages (pipeline_id, name, position)
  VALUES
    (v_lender_id, 'Out for Review', 0),
    (v_lender_id, 'Out for Approval', 1),
    (v_lender_id, 'Waiting on Borrower', 2),
    (v_lender_id, 'Term Sheet Issued', 3),
    (v_lender_id, 'Waiting on Borrower - Final Docs', 4),
    (v_lender_id, 'Lender & Client working towards closing', 5),
    (v_lender_id, 'Closing Scheduled', 6),
    (v_lender_id, 'Loan Closed', 7)
  ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Backfill pipeline_leads from existing leads.status
  -- -------------------------------------------------------

  -- Potential / Initial Contact  (discovery, questionnaire, initial_review)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_potential_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_potential_id AND ps.name = 'Initial Contact'
  WHERE l.status IN ('discovery', 'questionnaire', 'initial_review')
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Potential / In Process - On Hold  (pre_qualification)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_potential_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_potential_id AND ps.name = 'In Process - On Hold'
  WHERE l.status = 'pre_qualification'
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Potential / Incoming - On Hold  (onboarding)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_potential_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_potential_id AND ps.name = 'Incoming - On Hold'
  WHERE l.status = 'onboarding'
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Underwriting / Waiting Needs List Items  (document_collection, ready_for_wu_approval)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_underwriting_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_underwriting_id AND ps.name = 'Waiting Needs List Items'
  WHERE l.status IN ('document_collection', 'ready_for_wu_approval')
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Underwriting / Review Kill / Keep  (moving_to_underwriting)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_underwriting_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_underwriting_id AND ps.name = 'Review Kill / Keep'
  WHERE l.status = 'moving_to_underwriting'
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Underwriting / Initial Review  (underwriting)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_underwriting_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_underwriting_id AND ps.name = 'Initial Review'
  WHERE l.status = 'underwriting'
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Lender Management / Out for Review  (pre_approval_issued)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_lender_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_lender_id AND ps.name = 'Out for Review'
  WHERE l.status = 'pre_approval_issued'
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Lender Management / Out for Approval  (approval)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_lender_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_lender_id AND ps.name = 'Out for Approval'
  WHERE l.status = 'approval'
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Lender Management / Loan Closed  (funded, won)
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  SELECT v_lender_id, l.id, ps.id
  FROM public.leads l
  JOIN public.pipeline_stages ps
    ON ps.pipeline_id = v_lender_id AND ps.name = 'Loan Closed'
  WHERE l.status IN ('funded', 'won')
  ON CONFLICT (pipeline_id, lead_id) DO NOTHING;

  -- Note: leads with status = 'lost' are intentionally not placed in any pipeline

END $$;


-- ============================================================
-- Step 3: Sync trigger — keeps pipeline_leads in sync when
-- leads.status changes via the old UI
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_lead_status_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_name text;
  v_stage_name text;
  v_pipeline_id uuid;
  v_stage_id uuid;
BEGIN
  -- Map the new status to a pipeline + stage
  CASE NEW.status
    WHEN 'discovery', 'questionnaire', 'initial_review' THEN
      v_pipeline_name := 'Potential';
      v_stage_name := 'Initial Contact';
    WHEN 'pre_qualification' THEN
      v_pipeline_name := 'Potential';
      v_stage_name := 'In Process - On Hold';
    WHEN 'onboarding' THEN
      v_pipeline_name := 'Potential';
      v_stage_name := 'Incoming - On Hold';
    WHEN 'document_collection' THEN
      v_pipeline_name := 'Underwriting';
      v_stage_name := 'Waiting Needs List Items';
    WHEN 'moving_to_underwriting' THEN
      v_pipeline_name := 'Underwriting';
      v_stage_name := 'Review Kill / Keep';
    WHEN 'underwriting' THEN
      v_pipeline_name := 'Underwriting';
      v_stage_name := 'Initial Review';
    WHEN 'ready_for_wu_approval' THEN
      v_pipeline_name := 'Underwriting';
      v_stage_name := 'Waiting Needs List Items';
    WHEN 'pre_approval_issued' THEN
      v_pipeline_name := 'Lender Management';
      v_stage_name := 'Out for Review';
    WHEN 'approval' THEN
      v_pipeline_name := 'Lender Management';
      v_stage_name := 'Out for Approval';
    WHEN 'funded', 'won' THEN
      v_pipeline_name := 'Lender Management';
      v_stage_name := 'Loan Closed';
    WHEN 'lost' THEN
      -- Remove from all pipelines when lost
      DELETE FROM public.pipeline_leads WHERE lead_id = NEW.id;
      RETURN NEW;
    ELSE
      -- Unknown status, do nothing
      RETURN NEW;
  END CASE;

  -- Look up the target pipeline and stage
  SELECT p.id INTO v_pipeline_id
  FROM public.pipelines p
  WHERE p.name = v_pipeline_name AND p.is_system = true
  LIMIT 1;

  SELECT ps.id INTO v_stage_id
  FROM public.pipeline_stages ps
  WHERE ps.pipeline_id = v_pipeline_id AND ps.name = v_stage_name
  LIMIT 1;

  IF v_pipeline_id IS NULL OR v_stage_id IS NULL THEN
    -- Pipeline/stage not found; skip silently
    RETURN NEW;
  END IF;

  -- Remove lead from any other system pipeline (lead moves between pipelines)
  DELETE FROM public.pipeline_leads pl
  USING public.pipelines p
  WHERE pl.lead_id = NEW.id
    AND pl.pipeline_id = p.id
    AND p.is_system = true
    AND pl.pipeline_id != v_pipeline_id;

  -- Upsert into the target pipeline
  INSERT INTO public.pipeline_leads (pipeline_id, lead_id, stage_id)
  VALUES (v_pipeline_id, NEW.id, v_stage_id)
  ON CONFLICT (pipeline_id, lead_id)
  DO UPDATE SET stage_id = EXCLUDED.stage_id, updated_at = now();

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_sync_lead_status_to_pipeline ON public.leads;

CREATE TRIGGER trg_sync_lead_status_to_pipeline
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_status_to_pipeline();
