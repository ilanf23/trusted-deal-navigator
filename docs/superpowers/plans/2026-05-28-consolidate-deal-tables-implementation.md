# Deal Table Consolidation — Implementation Plan (#97)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen: inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. There is no automated test suite — the verification gate is `npm run build` (TypeScript) plus targeted runtime smoke checks. The refactor is **compiler-driven**: after Task 3 regenerates `types.ts`, every stale table reference becomes a `tsc` error, giving an exhaustive worklist.

**Goal:** Replace `potential` / `underwriting` / `lender_management` (+ their `_people` junctions and the `move_deal_between_pipelines` RPC) with a single `deals` table keyed by a `pipeline` enum and one `deal_people` junction, refactor all app + edge-function code, and deploy to the linked Supabase project.

**Architecture:** Two migrations (enum-value add, then the bundled consolidation). `deals` is cloned from `potential` (the column superset) via `LIKE ... INCLUDING ALL`, gains a `pipeline` enum, and is backfilled from all three tables preserving UUIDs. Inbound FKs and the polymorphic `entity_type='deal'` discriminator are re-pointed. Code is refactored against the regenerated types until `npm run build` is green.

**Tech Stack:** Supabase Postgres, supabase-js, React 18 + TypeScript + Vite, Deno edge functions. Context: pre-production, fake data, no test suite (memory `project_preprod_fake_data`).

**Scope decisions (locked):**
- Backfill existing fake rows (don't start empty).
- Standardize the deal discriminator to `entity_type = 'deal'` (fixes the `'pipeline'` vs `'potential'` mismatch).
- Keep `lead_id` column names on child tables (no rename — minimizes churn).
- **Deferred (NOT this pass):** dropping the now-redundant `entity_type` *columns* on deal-only child tables. Values are standardized to `'deal'`; column removal is a low-value, finicky follow-up. Flagged at the end.

---

### Task 1: Branch + add `'deal'` enum value (standalone migration)

**Files:**
- Create: `supabase/migrations/20260528180000_add_deal_entity_type.sql`

- [ ] **Step 1: Confirm branch**

Run: `git branch --show-current`
Expected: `feat/97-consolidate-deals-implementation` (already created). If not, `git checkout -b feat/97-consolidate-deals-implementation`.

- [ ] **Step 2: Write the enum-add migration**

`ALTER TYPE ... ADD VALUE` cannot be used in the same transaction it is declared, so it gets its own migration applied before the consolidation migration. `IF NOT EXISTS` makes it idempotent (value may or may not already exist remotely).

```sql
-- Add a single canonical 'deal' discriminator to entity_type_enum.
-- Polymorphic child tables currently tag deals with three pipeline-specific
-- values ('potential'/'pipeline'/'underwriting'/'lender_management'). After
-- consolidation a deal has one stable id regardless of pipeline, so children
-- use one value: 'deal'. Must be a separate migration from the consolidation —
-- Postgres forbids using a newly-added enum value in the same transaction.
ALTER TYPE public.entity_type_enum ADD VALUE IF NOT EXISTS 'deal';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260528180000_add_deal_entity_type.sql
git commit -m "feat(#97): add 'deal' value to entity_type_enum"
```

---

### Task 2: The consolidation migration

**Files:**
- Create: `supabase/migrations/20260528181000_consolidate_deal_tables.sql`

- [ ] **Step 1: Write the migration header + types/tables**

```sql
-- ============================================================
-- Migration: consolidate deal tables (#97)
-- potential / underwriting / lender_management  ->  deals (+ pipeline enum)
-- potential_people / underwriting_people / lender_management_people -> deal_people
-- Pre-production, fake data: bundled create + backfill + drop in one tx.
-- ============================================================
BEGIN;

-- 1. Pipeline enum
CREATE TYPE public.deal_pipeline AS ENUM ('potential','underwriting','lender_management');

-- 2. deals table cloned from potential (the column superset: 79 cols incl. the
--    10 prospect-only fields). LIKE copies columns/defaults/not-null/checks/indexes
--    but NOT foreign keys, RLS policies, or triggers — re-added below.
CREATE TABLE public.deals (LIKE public.potential INCLUDING ALL);
ALTER TABLE public.deals
  ADD COLUMN pipeline public.deal_pipeline NOT NULL DEFAULT 'potential';

-- Re-add FKs that LIKE does not copy (match source: schema.md potential).
ALTER TABLE public.deals
  ADD CONSTRAINT deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
  ADD CONSTRAINT deals_stage_id_fkey   FOREIGN KEY (stage_id)   REFERENCES public.pipeline_stages(id);

-- 3. deal_people junction (replaces the three identical per-pipeline junctions)
CREATE TABLE public.deal_people (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES public.people(id),
  role       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_people_deal_id_idx   ON public.deal_people(deal_id);
CREATE INDEX deal_people_person_id_idx ON public.deal_people(person_id);
```

- [ ] **Step 2: Backfill (preserving UUIDs)**

Insert each source table with its `pipeline` value. `potential` carries all 79 columns; `underwriting`/`lender_management` lack the 10 prospect-only columns (left to default NULL) and carry the extra `origin_pipeline_id` (intentionally not selected). Use explicit shared column lists to be safe.

```sql
-- potential -> deals (full column set; pipeline = 'potential')
INSERT INTO public.deals
SELECT p.*, 'potential'::public.deal_pipeline AS pipeline
FROM public.potential p
ON CONFLICT (id) DO NOTHING;

-- underwriting -> deals (shared 69 cols; prospect-only 10 -> NULL; pipeline = 'underwriting')
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

-- lender_management -> deals (same column list; pipeline = 'lender_management')
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

-- junctions -> deal_people
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
```

> NOTE on `SELECT p.*`: this relies on `potential`'s column order matching `deals` minus `pipeline`. Since `deals` was created `LIKE potential` and `pipeline` was appended last, `SELECT p.*, 'potential'` aligns. If the engineer prefers safety, expand `p.*` to the explicit 79-column list used above (without the trailing prospect-only NULLs). Verify column order with `\d public.potential` before running.

- [ ] **Step 3: Re-point inbound FKs to `deals`**

The four hard FKs currently target `potential`. Drop + recreate against `deals`. Constraint names vary; discover then re-point. (Engineer: confirm exact constraint names via `\d public.dropbox_files` etc. during execution; the pattern below uses the conventional `<table>_lead_id_fkey`.)

```sql
ALTER TABLE public.dropbox_files  DROP CONSTRAINT IF EXISTS dropbox_files_lead_id_fkey;
ALTER TABLE public.dropbox_files  ADD  CONSTRAINT dropbox_files_lead_id_fkey  FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
ALTER TABLE public.email_threads  DROP CONSTRAINT IF EXISTS email_threads_lead_id_fkey;
ALTER TABLE public.email_threads  ADD  CONSTRAINT email_threads_lead_id_fkey  FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
ALTER TABLE public.rate_watch     DROP CONSTRAINT IF EXISTS rate_watch_lead_id_fkey;
ALTER TABLE public.rate_watch     ADD  CONSTRAINT rate_watch_lead_id_fkey     FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
ALTER TABLE public.tasks          DROP CONSTRAINT IF EXISTS tasks_lead_id_fkey;
ALTER TABLE public.tasks          ADD  CONSTRAINT tasks_lead_id_fkey          FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE SET NULL;
```

- [ ] **Step 4: Standardize the `entity_type` discriminator to `'deal'`**

Across every deal-polymorphic child table (the 13 the move RPC re-pointed), collapse the pipeline-specific values to `'deal'`.

```sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activities','entity_emails','entity_phones','entity_files','entity_addresses',
    'entity_contacts','entity_followers','entity_projects','deal_lender_programs',
    'deal_responses','person_connections','person_other_contacts','underwriting_checklists',
    'dropbox_files','email_threads','rate_watch','tasks','deal_milestones','deal_waiting_on',
    'communications','notes','outbound_emails','appointments'
  ] LOOP
    EXECUTE format(
      'UPDATE public.%I SET entity_type = ''deal'' '
      'WHERE entity_type IN (''pipeline'',''potential'',''underwriting'',''lender_management'')',
      t
    );
  END LOOP;
END $$;
```

> Engineer: some tables in this array may not have an `entity_type` column or may not exist — wrap each `EXECUTE` in a per-table existence check, or trim the array to the confirmed set from `schema.md` (the 30-table list in the proposal §4b, intersected with deal-tagging tables). The `format`+`EXECUTE` will error on a missing column; add `IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=t AND column_name='entity_type')` guard.

- [ ] **Step 5: RLS + triggers on `deals` / `deal_people`, then drop old objects**

```sql
-- RLS: mirror 20260526190000_fix_deal_tables_rls_super_admin.sql
ALTER TABLE public.deals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and super admins can manage deals" ON public.deals FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Admins and super admins can manage deal_people" ON public.deal_people FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

-- Triggers: the three tables had trg_<t>_log_stage_change and trg_<t>_cleanup
-- (migration 20260412100000). Recreate the equivalents on deals, reusing the
-- same trigger functions. Engineer: read 20260412100000_platform_migration_readiness.sql
-- to copy the exact CREATE TRIGGER bodies/function names, then bind to public.deals.

-- Drop the move RPC (single-table model makes it obsolete)
DROP FUNCTION IF EXISTS public.move_deal_between_pipelines(uuid, text, text);

-- Drop junctions then parent tables (CASCADE clears origin_pipeline_id FKs)
DROP TABLE IF EXISTS public.potential_people, public.underwriting_people, public.lender_management_people;
DROP TABLE IF EXISTS public.potential, public.underwriting, public.lender_management CASCADE;

COMMIT;
```

- [ ] **Step 6: Recreate the stage-change + cleanup triggers (read the source first)**

Read `supabase/migrations/20260412100000_platform_migration_readiness.sql` for the exact `trg_*_log_stage_change` and `trg_*_cleanup` definitions and their trigger functions. Add `CREATE TRIGGER` statements binding those same functions to `public.deals` (inside the BEGIN/COMMIT, before the DROPs). Insert this code into the migration at the appropriate point. Verify the trigger functions are table-agnostic (use `TG_TABLE_NAME`/`NEW`) or generalize them if they hardcode a table name.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260528181000_consolidate_deal_tables.sql
git commit -m "feat(#97): consolidation migration — create deals, backfill, drop old tables"
```

---

### Task 3: Regenerate Supabase types & schema, establish the compiler worklist

**Files:**
- Modify: `src/integrations/supabase/types.ts`, `schema.md`

- [ ] **Step 1: Push the two migrations to the linked DB**

Run: `npm run db:push`
Expected: both migrations apply; `RAISE NOTICE` shows backfill counts. If it fails, read the error, fix the migration, re-run. **Do not proceed until the push succeeds.**

- [ ] **Step 2: Regenerate types**

Run: `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`
Expected: `deals` and `deal_people` now present; `potential`/`underwriting`/`lender_management` and their junctions gone.

- [ ] **Step 3: Regenerate schema.md**

Run: `npm run generate-schema`
Expected: `schema.md` reflects `deals` + `deal_people`, no old tables.

- [ ] **Step 4: Capture the compiler worklist**

Run: `npm run build 2>&1 | tee /tmp/tsc-errors.txt; grep -c "error TS" /tmp/tsc-errors.txt`
Expected: a list of TS errors — one per stale `'potential'|'underwriting'|'lender_management'` table reference. **This list is the exhaustive refactor checklist for Tasks 4–6.**

- [ ] **Step 5: Commit the regenerated artifacts**

```bash
git add src/integrations/supabase/types.ts schema.md
git commit -m "chore(#97): regenerate types + schema after consolidation migration"
```

---

### Task 4: Refactor the central pipeline seam

**Files:**
- Modify: `src/hooks/usePipelineMutations.ts`

- [ ] **Step 1: Replace the per-table CRUD helpers with single-table `deals` calls**

Rewrite `insertDeal`/`updateDealStage`/`selectDealById`/`deleteDeal`/`bulkDeleteDeals` to operate on `deals` carrying `pipeline`. Keep `CrmTable` as a `DealPipeline` alias (`'potential'|'underwriting'|'lender_management'`) so call sites that pass a pipeline keep compiling. Example new shape:

```ts
export type DealPipeline = 'potential' | 'underwriting' | 'lender_management';
export type CrmTable = DealPipeline; // back-compat alias

async function insertDeal(pipeline: DealPipeline, data: Record<string, unknown>) {
  return supabase.from('deals').insert({ ...data, pipeline } as any).select().single();
}
async function updateDealStage(_pipeline: DealPipeline, dealId: string, newStageId: string) {
  return supabase.from('deals')
    .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
    .eq('id', dealId);
}
async function selectDealById(_pipeline: DealPipeline, dealId: string) {
  return supabase.from('deals').select('*').eq('id', dealId).single();
}
async function deleteDeal(_pipeline: DealPipeline, dealId: string) {
  return supabase.from('deals').delete().eq('id', dealId);
}
async function bulkDeleteDeals(_pipeline: DealPipeline, dealIds: string[]) {
  return supabase.from('deals').delete().in('id', dealIds);
}
```

- [ ] **Step 2: Replace the move RPC with a single-field pipeline update + stage reseed**

```ts
export async function moveDealBetweenPipelines(
  dealId: string, source: CrmTable, target: CrmTable,
): Promise<void> {
  if (source === target) return;
  // Look up first stage of the target system pipeline.
  const pipelineName = PIPELINE_LABELS[target];
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id, pipelines!inner(name, is_system)')
    .eq('pipelines.name', pipelineName)
    .eq('pipelines.is_system', true)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from('deals')
    .update({ pipeline: target, stage_id: stage?.id ?? null })
    .eq('id', dealId);
  if (error) throw error;
}
```

Remove `ENTITY_TYPE_MAP` if now unused (or repoint any remaining consumer to the constant `'deal'`).

- [ ] **Step 3: Verify the seam compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "usePipelineMutations" || echo "seam clean"`
Expected: no errors originating in `usePipelineMutations.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePipelineMutations.ts
git commit -m "refactor(#97): point pipeline mutation seam at deals table"
```

---

### Task 5: Refactor all reads/writes flagged by the compiler (batched by area)

Work the `/tmp/tsc-errors.txt` list. For every error, apply the mechanical transform:
- `supabase.from('potential'|'underwriting'|'lender_management')` → `supabase.from('deals')` and add `.eq('pipeline', '<that value>')` on selects / `pipeline: '<that value>'` on inserts.
- `.eq('entity_type', 'potential'|'underwriting'|'lender_management'|'pipeline')` → `.eq('entity_type', 'deal')`.
- Any `origin_pipeline_id` reference → delete it.
- Type imports `Database['public']['Tables']['potential'...]` → `['deals']`.

**Files (from the proposal §7 inventory — 14 writers, ~40 readers; batch in this order):**

- [ ] **Step 1: Hooks batch** — `useAllPipelineLeads.ts`, `usePipelineLeads.ts`, `useLoanVolumeLog.ts`, `useFeedData.ts`, `useLeadEmailCompose.ts`, `useColumnOrder.ts`, `useScoreDealWithAI.ts`, dashboard hooks (`useSuperAdminDashboard.ts`, `useAdamsDashboard.ts`, `useMaurasDashboard.ts`, `useWendysDashboard.ts`). Apply the transform; run `npm run build 2>&1 | grep -c "error TS"` and confirm the count drops. Commit: `refactor(#97): point hooks at deals`.

- [ ] **Step 2: Admin components batch** — `Potential.tsx`-adjacent expanded/detail views and panels: `PipelineExpandedView.tsx`, `PipelineDetailPanel.tsx`, `UnderwritingExpandedView.tsx`, `UnderwritingDetailPanel.tsx`, `LenderManagementExpandedView.tsx`, `LenderExpandedView.tsx`, `ProjectExpandedView.tsx`, `ProjectDetailPanel.tsx`, `ProjectDetailDialog.tsx`, `LeadDetailDialog.tsx`, `ExpandedLeftColumn.tsx`, `InlineEditableFields.tsx`, `CompanyExpandedView.tsx`, `VolumeLogExpandedView.tsx`, `MoveBoxesModal.tsx`, `PipelineSelectField.tsx`, `shared/LeadRelatedSidebar.tsx`, `shared/PipelineRecordsSection.tsx`, `shared/LeadCallHistorySection.tsx`, `shared/useInlineSave.ts`, `splitview/pageRegistry.ts`, `files/types.ts`, `dashboard/useDashboardData.ts`. Build, confirm count drops. Commit: `refactor(#97): point admin components at deals`.

- [ ] **Step 3: Pages batch** — `pages/admin/Potential.tsx`, `Underwriting.tsx`, `LenderManagement.tsx`, `CRMBoard.tsx`, `EmployeePipeline.tsx`, `Dashboard.tsx`, `Scorecard.tsx`, `TeamPerformance.tsx`, `LoanVolumeLog.tsx`, `Calls.tsx`, `RateWatch.tsx`, `Projects.tsx`, `Marketing.tsx`, `PipelineFeed.tsx`, `Questionnaire.tsx`, `RateWatchQuestionnaire.tsx`. Build, confirm count drops. Commit: `refactor(#97): point admin pages at deals`.

- [ ] **Step 4: Employee + feed batch** — `employee/CommunicationsWidget.tsx`, `LeadsWidget.tsx`, `MetricsWidget.tsx`, `OutboundCallCard.tsx`, `calendar/EventDialog.tsx`, `dashboard/NudgesWidget.tsx`, `dashboard/RevenueChart.tsx`, `tasks/TaskDetailDialog.tsx`, `tasks/TaskWorkspace.tsx`, `feed/FeedRightPanel.tsx`. Build. Commit: `refactor(#97): point employee + feed at deals`.

- [ ] **Step 5: Build green gate**

Run: `npm run build`
Expected: **exit 0, no TS errors.** If errors remain, they are stale references the batches missed — fix them and re-run. Do not proceed until green.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors vs baseline.

---

### Task 6: Refactor the edge functions

**Files:** `supabase/functions/{score-deal-win-percentage,google-sheets-sync,ai-assistant-agent,lead-ai-assistant,generate-lead-email,call-to-lead-automation,twilio-call-history}/index.ts` and `supabase/functions/_shared/*`

- [ ] **Step 1: Apply the same transform in each function**

`grep -rn "potential\|underwriting\|lender_management" supabase/functions` and for each: swap `.from('<table>')` → `.from('deals')` + `.eq('pipeline','<x>')`; swap `.eq('entity_type','potential')` → `.eq('entity_type','deal')`. For `score-deal-win-percentage`, the four `entity_type='potential'` filters → `'deal'`, and `.from('potential')` → `.from('deals')`. For `google-sheets-sync`, keep `sheets_row_index`/`sheets_last_synced_at` logic; only change the table source.

- [ ] **Step 2: Type-check the Deno functions**

Run (per function): `deno check supabase/functions/score-deal-win-percentage/index.ts` (repeat for each edited function).
Expected: no type errors. (If `deno` is unavailable locally, rely on deploy-time check in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions
git commit -m "refactor(#97): point edge functions at deals table"
```

---

### Task 7: Deploy & verify

- [ ] **Step 1: Deploy edge functions**

Run: `npm run functions:deploy`
Expected: all functions deploy without error. (Migrations were already pushed in Task 3 Step 1.)

- [ ] **Step 2: Verify data counts in the DB**

Confirm `deals` row count == sum of the three old tables' pre-migration counts, and `deal_people` == sum of the three junctions. (Use Supabase SQL editor or `psql`. Pre-migration counts were RAISE NOTICE'd in Task 2.)

- [ ] **Step 3: Runtime smoke test**

Run: `npm run dev`, then exercise: CRM board for each pipeline (Potential/Underwriting/Lender Management pages load + show deals), drag a card to change pipeline (verify `pipeline` updates + stage reseeds, no console errors), open a deal's expanded view (dropbox/email/tasks/rate-watch related items resolve), super-admin + an employee dashboard render numbers, Scorecard + feed load. Note any breakage and fix before finishing.

- [ ] **Step 4: Final commit + push**

```bash
git add -A && git commit -m "chore(#97): finalize deal consolidation" --allow-empty
git push -u origin feat/97-consolidate-deals-implementation
```

---

## Deferred (flagged, not in this pass)
- Dropping the now-redundant `entity_type` *columns* on deal-only child tables (`deal_lender_programs`, `deal_milestones`, `deal_responses`, `deal_waiting_on`, `underwriting_checklists`). Values are standardized to `'deal'`; column removal needs per-table confirmation that nothing else tags them. Low value, do later if desired.
- Renaming child `lead_id` columns → `deal_id` (cosmetic).

## Self-Review (against the implementation spec)

| Spec section | Task |
| --- | --- |
| 1a New types/tables | Task 2 Step 1 |
| 1b Backfill | Task 2 Step 2 |
| 1c Re-point FKs + entity_type | Task 2 Steps 3–4 |
| 1d RLS/triggers/drops | Task 2 Steps 5–6 |
| 2 Code refactor (seam + 62 files) | Tasks 4–5 |
| 2 Edge functions | Task 6 |
| 3 Regenerate + deploy | Tasks 3 & 7 |
| 4 Verification | Task 7 Step 3 |
| Enum 'deal' (transaction gotcha) | Task 1 |

All spec sections map to tasks. Compiler-driven worklist (Task 3 Step 4) guarantees no stale frontend reference survives the `npm run build` gate (Task 5 Step 5).
