-- Update the Potential pipeline stages to match the simplified 5-stage layout:
--   0. Initial Contact
--   1. Incoming -- ON HOLD
--   2. In Process -- ON HOLD
--   3. Dead
--   4. Denied
--
-- Previous stages were:
--   Initial Contact, Incoming - On Hold, In Process - On Hold,
--   Waiting on Client to move forward, Complete Files for Review,
--   Maura Underwriting, Ready for WU Approval
--
-- Any lead currently pinned to one of the removed stages is reassigned to
-- "Initial Contact" before the stage is deleted so we don't violate the FK
-- from potential.stage_id / pipeline_leads.stage_id.

BEGIN;

DO $$
DECLARE
  v_potential_id         uuid;
  v_initial_contact_id   uuid;
BEGIN
  SELECT id INTO v_potential_id
  FROM public.pipelines
  WHERE name = 'Potential'
  LIMIT 1;

  IF v_potential_id IS NULL THEN
    RAISE NOTICE 'Potential pipeline not found — skipping stage rewrite';
    RETURN;
  END IF;

  SELECT id INTO v_initial_contact_id
  FROM public.pipeline_stages
  WHERE pipeline_id = v_potential_id
    AND name = 'Initial Contact'
  LIMIT 1;

  IF v_initial_contact_id IS NULL THEN
    INSERT INTO public.pipeline_stages (pipeline_id, name, position)
    VALUES (v_potential_id, 'Initial Contact', 0)
    RETURNING id INTO v_initial_contact_id;
  END IF;

  -- 1. Reassign any potential rows pointing to about-to-be-deleted stages
  UPDATE public.potential
  SET stage_id = v_initial_contact_id
  WHERE stage_id IN (
    SELECT id FROM public.pipeline_stages
    WHERE pipeline_id = v_potential_id
      AND name IN (
        'Waiting on Client to move forward',
        'Complete Files for Review',
        'Maura Underwriting',
        'Ready for WU Approval'
      )
  );

  -- 2. Reassign any pipeline_leads junction rows pointing to the same stages
  UPDATE public.pipeline_leads
  SET stage_id = v_initial_contact_id
  WHERE pipeline_id = v_potential_id
    AND stage_id IN (
      SELECT id FROM public.pipeline_stages
      WHERE pipeline_id = v_potential_id
        AND name IN (
          'Waiting on Client to move forward',
          'Complete Files for Review',
          'Maura Underwriting',
          'Ready for WU Approval'
        )
    );

  -- 3. Drop the unused stages
  DELETE FROM public.pipeline_stages
  WHERE pipeline_id = v_potential_id
    AND name IN (
      'Waiting on Client to move forward',
      'Complete Files for Review',
      'Maura Underwriting',
      'Ready for WU Approval'
    );

  -- 4. Rename the remaining "On Hold" stages to match the screenshot labels
  UPDATE public.pipeline_stages
  SET name = 'Incoming -- ON HOLD', position = 1
  WHERE pipeline_id = v_potential_id
    AND name = 'Incoming - On Hold';

  UPDATE public.pipeline_stages
  SET name = 'In Process -- ON HOLD', position = 2
  WHERE pipeline_id = v_potential_id
    AND name = 'In Process - On Hold';

  -- Make sure Initial Contact keeps position 0
  UPDATE public.pipeline_stages
  SET position = 0
  WHERE id = v_initial_contact_id;

  -- 5. Insert the two new terminal stages (idempotent)
  INSERT INTO public.pipeline_stages (pipeline_id, name, position)
  VALUES
    (v_potential_id, 'Dead',   3),
    (v_potential_id, 'Denied', 4)
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
