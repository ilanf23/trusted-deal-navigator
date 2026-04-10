-- =============================================================================
-- Platform Migration Readiness: Copper -> CLX
-- =============================================================================
-- Adds schema needed to host a full platform migration from Copper CRM and
-- closes feature parity gaps identified in the expanded view audit.
--
-- Sections:
--   1. Copper migration source tracking (idempotent re-runs, duplicate detection)
--   2. Won/Lost fields + custom fields JSONB on deal tables
--   3. Denormalized counters for list view performance
--   4. Fix orphaned notes table (add entity polymorphism)
--   5. Generalize underwriting_checklists -> entity_checklists across pipelines
--   6. Tag autocomplete view (deduplicated across all three pipelines)
--   7. Auto-log stage changes to activities (audit trail)
--   8. Auto-cascade cleanup of polymorphic child rows on deal delete
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Copper migration source tracking
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS copper_opportunity_id text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT ''clx''', tbl);
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_%I_copper_opportunity_id ON public.%I(copper_opportunity_id) WHERE copper_opportunity_id IS NOT NULL',
      tbl, tbl
    );
  END LOOP;
END $$;

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS copper_person_id text;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'clx';
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_copper_person_id
  ON public.people(copper_person_id) WHERE copper_person_id IS NOT NULL;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS copper_company_id text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'clx';
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_copper_company_id
  ON public.companies(copper_company_id) WHERE copper_company_id IS NOT NULL;

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS copper_activity_id text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'clx';
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_copper_activity_id
  ON public.activities(copper_activity_id) WHERE copper_activity_id IS NOT NULL;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS copper_task_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'clx';
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_copper_task_id
  ON public.tasks(copper_task_id) WHERE copper_task_id IS NOT NULL;

ALTER TABLE public.entity_files ADD COLUMN IF NOT EXISTS copper_file_id text;
ALTER TABLE public.entity_files ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'clx';
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_files_copper_file_id
  ON public.entity_files(copper_file_id) WHERE copper_file_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Won/Lost fields + deal_outcome + custom fields JSONB on all three deal tables
--    (probability is already covered by existing `win_percentage` column)
--
-- `deal_outcome` is the canonical pipeline-agnostic outcome status shown in
-- the Status dropdown of the expanded views (Open / Won / Lost / Abandoned).
-- It's independent of the pipeline-specific stage (stage_id / lead_status).
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  -- Create the enum once (idempotent).
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_outcome_enum') THEN
    CREATE TYPE public.deal_outcome_enum AS ENUM ('open', 'won', 'lost', 'abandoned');
  END IF;

  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deal_outcome public.deal_outcome_enum NOT NULL DEFAULT ''open''',
      tbl
    );
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS won_reason text', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS won_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lost_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT ''{}''::jsonb', tbl);
  END LOOP;

  -- Backfill: rows that already have `won = true` should surface as 'won',
  -- rows with a loss_reason should surface as 'lost'. Everything else stays 'open'.
  UPDATE public.potential
     SET deal_outcome = 'won'
   WHERE deal_outcome = 'open' AND COALESCE(won, false) = true;
  UPDATE public.potential
     SET deal_outcome = 'lost'
   WHERE deal_outcome = 'open' AND loss_reason IS NOT NULL AND loss_reason <> '';

  UPDATE public.underwriting
     SET deal_outcome = 'won'
   WHERE deal_outcome = 'open' AND status = 'won';
  UPDATE public.underwriting
     SET deal_outcome = 'lost'
   WHERE deal_outcome = 'open' AND status = 'lost';

  UPDATE public.lender_management
     SET deal_outcome = 'won'
   WHERE deal_outcome = 'open' AND status = 'won';
  UPDATE public.lender_management
     SET deal_outcome = 'lost'
   WHERE deal_outcome = 'open' AND status = 'lost';
END $$;

-- -----------------------------------------------------------------------------
-- 3. Denormalized counters (stop computing on every render)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['potential', 'underwriting', 'lender_management'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS interactions_count int NOT NULL DEFAULT 0', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz', tbl);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Fix orphaned notes table: give it entity polymorphism
-- -----------------------------------------------------------------------------

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS entity_type public.entity_type_enum;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS title text;
CREATE INDEX IF NOT EXISTS idx_notes_entity
  ON public.notes(entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Generalized checklists across all pipelines
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.entity_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid NOT NULL,
  entity_type public.entity_type_enum NOT NULL,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entity_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id uuid NOT NULL REFERENCES public.entity_checklists(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage entity checklists"
  ON public.entity_checklists FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can manage entity checklist items"
  ON public.entity_checklist_items FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_entity_checklists_entity
  ON public.entity_checklists(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_checklist_items_checklist_id
  ON public.entity_checklist_items(checklist_id);

COMMENT ON TABLE public.entity_checklists IS
  'Polymorphic checklist store used by all pipeline expanded views.';

-- -----------------------------------------------------------------------------
-- 6. Tag autocomplete view
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.all_deal_tags AS
  SELECT DISTINCT unnest(tags) AS tag, 'potential'::text AS entity_type
    FROM public.potential WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  UNION
  SELECT DISTINCT unnest(tags) AS tag, 'underwriting'::text AS entity_type
    FROM public.underwriting WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  UNION
  SELECT DISTINCT unnest(tags) AS tag, 'lender_management'::text AS entity_type
    FROM public.lender_management WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

COMMENT ON VIEW public.all_deal_tags IS
  'Deduplicated list of tags across all pipeline tables for tag autocomplete.';

-- -----------------------------------------------------------------------------
-- 7. Auto-log stage changes to activities + stamp stage_changed_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_stage_name text;
  new_stage_name text;
  actor_name text;
  entity_type_val public.entity_type_enum;
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    entity_type_val := TG_ARGV[0]::public.entity_type_enum;

    SELECT name INTO old_stage_name FROM public.pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;
    SELECT COALESCE(name, email) INTO actor_name FROM public.users WHERE id = auth.uid();

    INSERT INTO public.activities (entity_id, entity_type, activity_type, title, content, created_by)
    VALUES (
      NEW.id,
      entity_type_val,
      'stage_change',
      'Stage changed',
      format(
        'Stage moved from %s to %s',
        COALESCE(old_stage_name, 'none'),
        COALESCE(new_stage_name, 'none')
      ),
      COALESCE(actor_name, 'System')
    );

    NEW.stage_changed_at := now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_potential_log_stage_change ON public.potential;
CREATE TRIGGER trg_potential_log_stage_change
  BEFORE UPDATE ON public.potential
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change('potential');

DROP TRIGGER IF EXISTS trg_underwriting_log_stage_change ON public.underwriting;
CREATE TRIGGER trg_underwriting_log_stage_change
  BEFORE UPDATE ON public.underwriting
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change('underwriting');

DROP TRIGGER IF EXISTS trg_lender_management_log_stage_change ON public.lender_management;
CREATE TRIGGER trg_lender_management_log_stage_change
  BEFORE UPDATE ON public.lender_management
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change('lender_management');

-- -----------------------------------------------------------------------------
-- 8. Cascade cleanup for polymorphic child rows on deal delete
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_deal_polymorphic_children()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entity_type_val public.entity_type_enum;
BEGIN
  entity_type_val := TG_ARGV[0]::public.entity_type_enum;

  DELETE FROM public.activities
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.activity_comments
    WHERE lead_id = OLD.id;
  DELETE FROM public.entity_contacts
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_files
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_projects
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_checklists
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.notes
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_potential_cleanup ON public.potential;
CREATE TRIGGER trg_potential_cleanup
  BEFORE DELETE ON public.potential
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_deal_polymorphic_children('potential');

DROP TRIGGER IF EXISTS trg_underwriting_cleanup ON public.underwriting;
CREATE TRIGGER trg_underwriting_cleanup
  BEFORE DELETE ON public.underwriting
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_deal_polymorphic_children('underwriting');

DROP TRIGGER IF EXISTS trg_lender_management_cleanup ON public.lender_management;
CREATE TRIGGER trg_lender_management_cleanup
  BEFORE DELETE ON public.lender_management
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_deal_polymorphic_children('lender_management');

-- -----------------------------------------------------------------------------
-- Done.
-- -----------------------------------------------------------------------------
