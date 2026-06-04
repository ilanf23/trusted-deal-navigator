-- ============================================================
-- Migration: consolidate deal tables (#97)
--   potential / underwriting / lender_management  ->  deals (+ pipeline enum)
--   *_people junctions                            ->  deal_people
--   move_deal_between_pipelines RPC               ->  removed (single-table model)
--
-- Pre-production, fake data: bundled create + backfill + drop in one tx.
-- See docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 1. Pipeline enum + deals table (cloned from potential, the column superset)
-- ------------------------------------------------------------
CREATE TYPE public.deal_pipeline AS ENUM ('potential', 'underwriting', 'lender_management');

-- LIKE copies columns/defaults/not-null/checks/indexes/PK, but NOT foreign
-- keys, RLS, or triggers (re-added below). 'potential' carries all 79 columns
-- including the 10 prospect-only fields, so it is the correct template.
CREATE TABLE public.deals (LIKE public.potential INCLUDING ALL);
ALTER TABLE public.deals
  ADD COLUMN pipeline public.deal_pipeline NOT NULL DEFAULT 'potential';

-- Re-add the foreign keys LIKE does not copy (match schema.md: potential).
ALTER TABLE public.deals
  ADD CONSTRAINT deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
  ADD CONSTRAINT deals_stage_id_fkey    FOREIGN KEY (stage_id)    REFERENCES public.pipeline_stages(id);

-- ------------------------------------------------------------
-- 2. deal_people junction (replaces the three identical per-pipeline junctions)
-- ------------------------------------------------------------
CREATE TABLE public.deal_people (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES public.people(id),
  role       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_people_deal_id_idx   ON public.deal_people(deal_id);
CREATE INDEX deal_people_person_id_idx ON public.deal_people(person_id);

-- ------------------------------------------------------------
-- 3. Backfill (preserving UUIDs). deals column order == potential's + pipeline,
--    so SELECT p.*, <pipeline> aligns for potential. underwriting/lender_management
--    use an explicit shared-column list (10 prospect-only fields default NULL,
--    origin_pipeline_id intentionally dropped).
-- ------------------------------------------------------------
INSERT INTO public.deals
SELECT p.*, 'potential'::public.deal_pipeline AS pipeline
FROM public.potential p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deals (
  id, name, email, phone, company_name, status, stage_id, source, notes, assigned_to,
  qualified_at, converted_at, converted_to_client_id, known_as, title, contact_type, tags,
  about, next_action, waiting_on, sla_threshold_days, last_activity_at, initial_nudge_created_at,
  cohort_year, flagged_for_weekly, uw_number, client_other_lenders, deal_value, history,
  bank_relationships, opportunity_name, clx_file_name, description, close_date, loss_reason,
  priority, win_percentage, visibility, last_contacted, target_closing_date, clx_agreement,
  loan_category, wu_date, loan_stage, won, lender_type, lender_name, fee_percent,
  potential_revenue, referral_source, rs_fee_percent, rs_revenue, net_revenue, invoice_amount,
  actual_net_revenue, volume_log_status, sheets_row_index, sheets_last_synced_at, created_at,
  updated_at, deal_outcome, copper_opportunity_id, source_system, won_reason, won_at, lost_at,
  custom_fields, interactions_count, stage_changed_at, pipeline
)
SELECT
  id, name, email, phone, company_name, status, stage_id, source, notes, assigned_to,
  qualified_at, converted_at, converted_to_client_id, known_as, title, contact_type, tags,
  about, next_action, waiting_on, sla_threshold_days, last_activity_at, initial_nudge_created_at,
  cohort_year, flagged_for_weekly, uw_number, client_other_lenders, deal_value, history,
  bank_relationships, opportunity_name, clx_file_name, description, close_date, loss_reason,
  priority, win_percentage, visibility, last_contacted, target_closing_date, clx_agreement,
  loan_category, wu_date, loan_stage, won, lender_type, lender_name, fee_percent,
  potential_revenue, referral_source, rs_fee_percent, rs_revenue, net_revenue, invoice_amount,
  actual_net_revenue, volume_log_status, sheets_row_index, sheets_last_synced_at, created_at,
  updated_at, deal_outcome, copper_opportunity_id, source_system, won_reason, won_at, lost_at,
  custom_fields, interactions_count, stage_changed_at, 'underwriting'::public.deal_pipeline
FROM public.underwriting
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deals (
  id, name, email, phone, company_name, status, stage_id, source, notes, assigned_to,
  qualified_at, converted_at, converted_to_client_id, known_as, title, contact_type, tags,
  about, next_action, waiting_on, sla_threshold_days, last_activity_at, initial_nudge_created_at,
  cohort_year, flagged_for_weekly, uw_number, client_other_lenders, deal_value, history,
  bank_relationships, opportunity_name, clx_file_name, description, close_date, loss_reason,
  priority, win_percentage, visibility, last_contacted, target_closing_date, clx_agreement,
  loan_category, wu_date, loan_stage, won, lender_type, lender_name, fee_percent,
  potential_revenue, referral_source, rs_fee_percent, rs_revenue, net_revenue, invoice_amount,
  actual_net_revenue, volume_log_status, sheets_row_index, sheets_last_synced_at, created_at,
  updated_at, deal_outcome, copper_opportunity_id, source_system, won_reason, won_at, lost_at,
  custom_fields, interactions_count, stage_changed_at, pipeline
)
SELECT
  id, name, email, phone, company_name, status, stage_id, source, notes, assigned_to,
  qualified_at, converted_at, converted_to_client_id, known_as, title, contact_type, tags,
  about, next_action, waiting_on, sla_threshold_days, last_activity_at, initial_nudge_created_at,
  cohort_year, flagged_for_weekly, uw_number, client_other_lenders, deal_value, history,
  bank_relationships, opportunity_name, clx_file_name, description, close_date, loss_reason,
  priority, win_percentage, visibility, last_contacted, target_closing_date, clx_agreement,
  loan_category, wu_date, loan_stage, won, lender_type, lender_name, fee_percent,
  potential_revenue, referral_source, rs_fee_percent, rs_revenue, net_revenue, invoice_amount,
  actual_net_revenue, volume_log_status, sheets_row_index, sheets_last_synced_at, created_at,
  updated_at, deal_outcome, copper_opportunity_id, source_system, won_reason, won_at, lost_at,
  custom_fields, interactions_count, stage_changed_at, 'lender_management'::public.deal_pipeline
FROM public.lender_management
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deal_people (deal_id, person_id, role, created_at)
SELECT potential_id, person_id, role, created_at FROM public.potential_people
UNION ALL
SELECT underwriting_id, person_id, role, created_at FROM public.underwriting_people
UNION ALL
SELECT lender_management_id, person_id, role, created_at FROM public.lender_management_people;

DO $$
BEGIN
  RAISE NOTICE 'deals backfilled: %', (SELECT count(*) FROM public.deals);
  RAISE NOTICE 'deal_people backfilled: %', (SELECT count(*) FROM public.deal_people);
END $$;

-- ------------------------------------------------------------
-- 4. Re-point inbound FKs from potential to deals
-- ------------------------------------------------------------
ALTER TABLE public.dropbox_files  DROP CONSTRAINT IF EXISTS dropbox_files_lead_id_fkey;
ALTER TABLE public.dropbox_files  ADD  CONSTRAINT dropbox_files_lead_id_fkey  FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
ALTER TABLE public.email_threads  DROP CONSTRAINT IF EXISTS email_threads_lead_id_fkey;
ALTER TABLE public.email_threads  ADD  CONSTRAINT email_threads_lead_id_fkey  FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
ALTER TABLE public.rate_watch     DROP CONSTRAINT IF EXISTS rate_watch_lead_id_fkey;
ALTER TABLE public.rate_watch     ADD  CONSTRAINT rate_watch_lead_id_fkey     FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
ALTER TABLE public.tasks          DROP CONSTRAINT IF EXISTS tasks_lead_id_fkey;
ALTER TABLE public.tasks          ADD  CONSTRAINT tasks_lead_id_fkey          FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 5. Standardize the polymorphic entity_type discriminator to 'deal'
--    (guarded: skip any table lacking an entity_type column)
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activities','activity_comments','appointments','call_events','call_rating_notifications',
    'communications','deal_lender_programs','deal_milestones','deal_responses','deal_waiting_on',
    'dropbox_files','email_threads','entity_addresses','entity_contacts','entity_emails',
    'entity_files','entity_followers','entity_phones','entity_projects','outbound_emails',
    'partner_referrals','person_connections','person_other_contacts','rate_watch','tasks',
    'underwriting_checklists','ratewatch_questionnaire_responses','active_calls'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'entity_type'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET entity_type = ''deal'' '
        'WHERE entity_type IN (''pipeline'',''potential'',''underwriting'',''lender_management'')',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 6. RLS on deals + deal_people (mirror 20260526190000)
-- ------------------------------------------------------------
ALTER TABLE public.deals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and super admins can manage deals" ON public.deals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins and super admins can manage deal_people" ON public.deal_people FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ------------------------------------------------------------
-- 7. Triggers on deals. Reuse the existing table-agnostic trigger functions
--    with entity_type arg 'deal'. Also CREATE OR REPLACE the cleanup function
--    to remove its dependency on the dropped `notes` table (latent bug: the
--    20260528170000 drop did not patch this function).
-- ------------------------------------------------------------
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

  DELETE FROM public.activities      WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.activity_comments WHERE lead_id = OLD.id;
  DELETE FROM public.entity_contacts WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_files    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_projects WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_emails   WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_phones   WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_addresses WHERE entity_id = OLD.id AND entity_type = entity_type_val;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_deals_log_stage_change ON public.deals;
CREATE TRIGGER trg_deals_log_stage_change
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change('deal');

DROP TRIGGER IF EXISTS trg_deals_cleanup ON public.deals;
CREATE TRIGGER trg_deals_cleanup
  BEFORE DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_deal_polymorphic_children('deal');

-- ------------------------------------------------------------
-- 8. Drop the obsolete move RPC, junctions, and the three source tables
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.move_deal_between_pipelines(uuid, text, text);

DROP TABLE IF EXISTS public.potential_people;
DROP TABLE IF EXISTS public.underwriting_people;
DROP TABLE IF EXISTS public.lender_management_people;

DROP TABLE IF EXISTS public.potential CASCADE;
DROP TABLE IF EXISTS public.underwriting CASCADE;
DROP TABLE IF EXISTS public.lender_management CASCADE;

COMMIT;
