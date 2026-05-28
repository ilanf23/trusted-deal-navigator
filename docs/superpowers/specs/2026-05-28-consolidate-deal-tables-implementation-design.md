# Deal Table Consolidation — Implementation Design (#97)

**Status:** Approved by Ilan (2026-05-28) — bundled, single-pass execution.
**Context:** App is pre-production; all data is fake/seed (see memory `project_preprod_fake_data`). No backup, staging, or downtime gating required. Implements the merged discovery proposal `2026-05-28-consolidate-deal-tables-design.md`.
**Goal:** Replace `potential` / `underwriting` / `lender_management` with a single `deals` table (+ `pipeline` enum) and `deal_people`, refactor all app code, and deploy.

---

## 1. Migration (one file, one transaction)

File: `supabase/migrations/<timestamp>_consolidate_deal_tables.sql`. Wrapped in `BEGIN/COMMIT`.

### 1a. New types & tables
- `CREATE TYPE deal_pipeline AS ENUM ('potential','underwriting','lender_management');`
- `CREATE TABLE public.deals (LIKE public.potential INCLUDING ALL);` — inherits all 79 columns, defaults, not-null, checks, indexes. (`potential` is the column superset.)
  - `ALTER TABLE public.deals ADD COLUMN pipeline public.deal_pipeline NOT NULL DEFAULT 'potential';`
  - Re-add FKs that `LIKE` does not copy: `assigned_to → users(id)`, `stage_id → pipeline_stages(id)`, `converted_to_client_id` (match source nullability/on-delete).
  - `origin_pipeline_id` is intentionally **not** added (potential never had it).
- `CREATE TABLE public.deal_people (id uuid pk default gen_random_uuid(), deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE, person_id uuid NOT NULL REFERENCES public.people(id), role text, created_at timestamptz NOT NULL DEFAULT now());`

### 1b. Backfill (preserve UUIDs)
- Insert all `potential` rows into `deals` with `pipeline='potential'` (column lists match).
- Insert `underwriting` rows with `pipeline='underwriting'` (shared 69 cols; prospect-only 10 → NULL).
- Insert `lender_management` rows with `pipeline='lender_management'` (same).
- Backfill `deal_people` by UNION of the three junctions, mapping `<pipeline>_id → deal_id`.
- **No collision expected** — the move RPC preserved UUIDs and deleted source rows, so a deal lives in one table at a time. Add `ON CONFLICT (id) DO NOTHING` as a guard and `RAISE NOTICE` the counts.

### 1c. Re-point inbound FKs & discriminator
- Re-point hard FKs to `deals`: `dropbox_files.lead_id`, `email_threads.lead_id`, `rate_watch.lead_id`, `tasks.lead_id` (drop old FK constraint → add new one referencing `deals`). Column name stays `lead_id` (no rename — minimizes code churn).
- Collapse `entity_type` deal-values to a single canonical `'deal'`:
  - Ensure `'deal'` exists in `entity_type_enum` (it does).
  - `UPDATE <child> SET entity_type='deal' WHERE entity_type IN ('pipeline','potential','underwriting','lender_management')` across the 13 deal-polymorphic child tables (the set the move RPC touched + any others confirmed deal-only).
- Drop `entity_type` column entirely on deal-**only** child tables: `deal_lender_programs`, `deal_milestones`, `deal_responses`, `deal_waiting_on`, `underwriting_checklists` — **only after** verifying each tags nothing but deals (check in plan). Keep `entity_type` on tables that also tag people/companies/lender_programs.

### 1d. RLS, triggers, drops
- Enable RLS on `deals` + `deal_people`; recreate the `FOR ALL` admin/super_admin policy (mirror `20260526190000_fix_deal_tables_rls_super_admin.sql`).
- Recreate any triggers the three tables had (e.g. `updated_at`, notifications link-url, stage-change). Enumerate in plan from migrations grep; re-point to `deals`.
- `DROP FUNCTION public.move_deal_between_pipelines(uuid,text,text);`
- `DROP TABLE public.potential_people, public.underwriting_people, public.lender_management_people;`
- `DROP TABLE public.potential, public.underwriting, public.lender_management CASCADE;` (`origin_pipeline_id` FKs vanish with them).

## 2. Code refactor (~62 frontend files + 8 edge functions)

**Central seam:** `src/hooks/usePipelineMutations.ts` defines `CrmTable`, `QUERY_KEY_MAP`, `PIPELINE_LABELS`, `ENTITY_TYPE_MAP`. Introduce a single source of truth here:
- Keep a `DealPipeline` type = `'potential'|'underwriting'|'lender_management'`.
- All `supabase.from('potential'|'underwriting'|'lender_management')` → `supabase.from('deals')` with `.eq('pipeline', <x>)` on reads and `pipeline: <x>` on writes.
- Replace `moveDealBetweenPipelines()` (RPC wrapper) with: `supabase.from('deals').update({ pipeline, stage_id: <first stage of target pipeline> }).eq('id', id)`. Delete the RPC call and `ENTITY_TYPE_MAP` indirection where it pointed at three values.
- The per-table `insertDeal`/`updateDealStage`/`selectDealById`/`deleteDeal`/`bulkDeleteDeals` switch helpers collapse to single-table calls carrying `pipeline`.

**Behavioral grouping** (from inventory §7 of the proposal): 14 writers, 8 triple-branchers (highest care), ~40 readers. Readers mostly swap the table name + add a `pipeline` filter. Edge functions: `score-deal-win-percentage` (reads/writes `deals`, `entity_type='deal'`), `google-sheets-sync` (preserve `sheets_row_index`/`sheets_last_synced_at`), and 6 others swap table names.

**Child-table queries:** any `.eq('entity_type', 'potential'|'pipeline'|'underwriting'|'lender_management')` → `.eq('entity_type','deal')`.

## 3. Regenerate & deploy
- `npm run generate-schema` → refresh `schema.md`.
- Regenerate `src/integrations/supabase/types.ts` (Supabase types) so TS compiles against `deals`.
- `npm run build` must pass (the only real gate, since there are no tests).
- `npm run deploy` (= `db:push` + `functions:deploy`) to push migration + edge functions. Frontend deploy is Ilan's normal flow.

## 4. Verification (manual — no test suite)
- `npm run build` green; `npm run lint` no new errors.
- App boots; smoke-check the surfaces that read deals: CRM board (`Potential`/`Underwriting`/`LenderManagement` pages), pipeline drag-move (pipeline change + stage reseed), dashboards (super-admin + employee), Scorecard, feed, calls/RateWatch, dropbox/email/tasks links resolve to `deals`.
- Confirm post-migration row counts: `deals` == sum of the three old tables; `deal_people` == sum of the three junctions.

## 5. Out of scope / risks
- `entity_type` stays on people/company-tagging tables (not fully removed — by design).
- Renaming `lead_id` → `deal_id` deferred (avoids extra code churn; can be a later cosmetic migration).
- Frontend production deploy is Ilan's step; this work pushes DB + edge functions.
