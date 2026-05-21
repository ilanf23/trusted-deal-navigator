# Drop Dead `entity_checklists` Tables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the unused `entity_checklists` and `entity_checklist_items` tables from the database, remove the dead reference from the `cleanup_deal_polymorphic_children` trigger function, and regenerate the schema documentation so it reflects reality.

**Architecture:** Single forward-only SQL migration under `supabase/migrations/`. The migration first patches the trigger function to remove its DELETE on `entity_checklists`, then drops the two tables (child first because of the FK). After the migration is applied to remote, regenerate `schema.md` and the Supabase TypeScript types so generated artifacts match the live DB.

**Tech Stack:** Supabase (PostgreSQL 15+), raw SQL migration files, `npm run db:push` to apply, `npm run generate-schema` to refresh docs.

---

## Context the engineer needs

- These tables were created by `supabase/migrations/20260412100000_platform_migration_readiness.sql` as a polymorphic checklist store intended to replace `underwriting_checklists`. The cutover never happened.
- **Verified zero application references:** `grep -rln "entity_checklist" src/ supabase/functions/` returns no hits. The only reference in the whole repo is inside `20260412100000_platform_migration_readiness.sql`.
- **Hidden coupling:** the `cleanup_deal_polymorphic_children(text)` trigger function (defined in that same migration) contains `DELETE FROM public.entity_checklists WHERE entity_id = OLD.id AND entity_type = entity_type_val;`. Postgres does **not** validate function bodies against schema changes at `DROP TABLE` time — it will only fail at runtime when a deal is deleted. So we must patch the function before dropping the tables.
- The `underwriting_checklists` + `underwriting_checklist_items` tables are the ones actually in use (`SavedChecklistCard.tsx`, `UnderwritingExpandedView.tsx`, `useFeedData.ts`). They are out of scope — do not touch them.
- This repo has no automated tests, so verification is done by SQL queries + manual smoke test of deal deletion.

## File structure

- **Create:** `supabase/migrations/20260521120000_drop_entity_checklists_tables.sql` — the migration.
- **Auto-regenerated:** `schema.md` (via `npm run generate-schema`) and `src/integrations/supabase/types.ts` (via Supabase CLI if used).
- **No `src/` changes** — code does not reference these tables.

---

## Task 1: Pre-flight verification

**Files:** none (verification only).

- [ ] **Step 1: Confirm zero code references**

Run:
```bash
grep -rn "entity_checklist" /Users/ilanfridman/trusted-deal-navigator/src/ /Users/ilanfridman/trusted-deal-navigator/supabase/functions/
```
Expected output: empty (no matches). If anything appears, STOP and surface to the user — the dead-code assumption is wrong.

- [ ] **Step 2: Confirm the trigger function is the only DB-side dependency**

Run:
```bash
grep -rn "entity_checklist" /Users/ilanfridman/trusted-deal-navigator/supabase/migrations/
```
Expected: only `supabase/migrations/20260412100000_platform_migration_readiness.sql` is matched.

- [ ] **Step 3: Confirm there is no view depending on these tables**

If the user can run a query against the remote DB (via Supabase dashboard or psql), execute:
```sql
SELECT dependent_ns.nspname AS dependent_schema,
       dependent_view.relname AS dependent_view
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_namespace AS dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
JOIN pg_class AS source_table ON pg_depend.refobjid = source_table.oid
WHERE source_table.relname IN ('entity_checklists', 'entity_checklist_items')
  AND dependent_view.relkind = 'v';
```
Expected: 0 rows. If any view shows up, STOP — the plan needs to be revised to handle the dependency.

- [ ] **Step 4: Check live row count (so we know what we'd be deleting)**

```sql
SELECT 'entity_checklists' AS table_name, COUNT(*) AS rows FROM public.entity_checklists
UNION ALL
SELECT 'entity_checklist_items', COUNT(*) FROM public.entity_checklist_items;
```
Expected: both 0. If non-zero, surface the count to the user and ask whether they want to proceed (rows would be lost on DROP). Do not continue until they confirm.

---

## Task 2: Write the migration

**Files:**
- Create: `supabase/migrations/20260521120000_drop_entity_checklists_tables.sql`

- [ ] **Step 1: Create the migration file with the patch + drops**

Write the file with exactly this content:

```sql
-- Drop unused entity_checklists + entity_checklist_items tables.
--
-- These tables were created by 20260412100000_platform_migration_readiness.sql
-- as a polymorphic replacement for underwriting_checklists, but the cutover
-- never happened. Zero application code references them. Underwriting still
-- uses underwriting_checklists + underwriting_checklist_items.
--
-- The cleanup_deal_polymorphic_children() trigger function still references
-- entity_checklists; we patch it here before dropping the tables, otherwise
-- deal deletion would fail at runtime.

-- 1. Patch the trigger function to remove its dependency on entity_checklists.
--    All other behavior is preserved verbatim from the original definition
--    in 20260412100000_platform_migration_readiness.sql.
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

  DELETE FROM public.notes
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_emails
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_phones
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;
  DELETE FROM public.entity_addresses
    WHERE entity_id = OLD.id AND entity_type = entity_type_val;

  RETURN OLD;
END $$;

-- 2. Drop the child table first (FK to entity_checklists).
DROP TABLE IF EXISTS public.entity_checklist_items;

-- 3. Drop the parent table.
DROP TABLE IF EXISTS public.entity_checklists;
```

> ⚠️ **Before writing this file, read lines around the original `cleanup_deal_polymorphic_children` function in `supabase/migrations/20260412100000_platform_migration_readiness.sql`.** The body shown above reconstructs the function from the visible fragments — if the actual function has additional `DELETE` blocks (e.g. for `entity_contacts`, `entity_files`, `entity_followers`, `entity_projects`, `entity_checklist_items`), preserve all of them in the new definition. Only remove the line that targets `entity_checklists`. Failing to preserve other deletes will leak orphaned rows on deal deletion.

- [ ] **Step 2: Visually confirm the function body matches the original (minus `entity_checklists`)**

Open `supabase/migrations/20260412100000_platform_migration_readiness.sql`, find the `CREATE OR REPLACE FUNCTION public.cleanup_deal_polymorphic_children` definition, and diff it against your new file mentally. The new function body must contain a `DELETE FROM` for every table the old one did, except `entity_checklists`.

If they don't match, fix your new migration file before continuing.

- [ ] **Step 3: Commit the migration file (pre-deploy)**

```bash
cd /Users/ilanfridman/trusted-deal-navigator
git add supabase/migrations/20260521120000_drop_entity_checklists_tables.sql
git commit -m "chore: add migration to drop unused entity_checklists tables"
```

---

## Task 3: Apply the migration to remote

**Files:** none modified.

- [ ] **Step 1: Run db:push**

```bash
cd /Users/ilanfridman/trusted-deal-navigator
npm run db:push
```
Expected: Supabase CLI reports the new migration was applied. If it errors with "relation `entity_checklists` does not exist" the table was already dropped — safe to continue. Any other error: STOP and surface to user.

- [ ] **Step 2: Verify tables are gone**

If the user can query the remote DB:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('entity_checklists', 'entity_checklist_items');
```
Expected: 0 rows.

- [ ] **Step 3: Verify the trigger function no longer references the dropped table**

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'cleanup_deal_polymorphic_children';
```
Expected: no occurrence of `entity_checklists` in the returned function body. The other `DELETE` blocks (notes, entity_emails, entity_phones, entity_addresses, plus any others preserved from the original) should still be present.

- [ ] **Step 4: Smoke-test deal deletion**

In the running app (or via SQL on a throwaway deal):
1. Pick a deal in the `potential` table with no business-critical data (or create a test row).
2. Delete it: `DELETE FROM public.potential WHERE id = '<test-deal-id>';`
3. Confirm no error is raised. If the trigger function references a non-existent table, this is where it would surface.

---

## Task 4: Regenerate generated artifacts

**Files:**
- Modify (regenerated): `schema.md`
- Modify (regenerated, if applicable): `src/integrations/supabase/types.ts`

- [ ] **Step 1: Regenerate schema.md**

```bash
cd /Users/ilanfridman/trusted-deal-navigator
npm run generate-schema
```
Expected: `schema.md` is updated. The script requires `DB_PASSWORD` in `.env` (per CLAUDE.md). If missing, ask the user to add it before running.

- [ ] **Step 2: Verify schema.md no longer lists the dropped tables**

```bash
grep -n "entity_checklists\|entity_checklist_items" /Users/ilanfridman/trusted-deal-navigator/schema.md
```
Expected: empty.

- [ ] **Step 3: Regenerate Supabase TypeScript types (if user has the CLI configured)**

Ask the user whether they regenerate `types.ts` via `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts` or another method. If yes, run it; if they don't have a reproducible command, leave `types.ts` for the next time they manually regenerate — the stale type entries are harmless (just unused).

If types are regenerated, verify:
```bash
grep -n "entity_checklists\|entity_checklist_items" /Users/ilanfridman/trusted-deal-navigator/src/integrations/supabase/types.ts
```
Expected: empty (or some pre-existing comment but no type definition).

- [ ] **Step 4: Commit the regenerated artifacts**

```bash
cd /Users/ilanfridman/trusted-deal-navigator
git add schema.md
# Add types.ts only if you regenerated it in Step 3
git add src/integrations/supabase/types.ts 2>/dev/null || true
git commit -m "chore: regenerate schema docs after dropping entity_checklists tables"
```

---

## Task 5: Final verification

- [ ] **Step 1: Final repo-wide grep — should return zero hits anywhere meaningful**

```bash
grep -rn "entity_checklist" /Users/ilanfridman/trusted-deal-navigator/src/ /Users/ilanfridman/trusted-deal-navigator/supabase/functions/ /Users/ilanfridman/trusted-deal-navigator/schema.md
```
Expected: empty.

The only remaining reference should be in the original `20260412100000_platform_migration_readiness.sql` (which is fine — migrations are historical records and must not be edited).

- [ ] **Step 2: Confirm with the user**

Report back to the user: tables dropped, function patched, schema regenerated, deal deletion smoke-tested.

---

## Rollback

If something goes wrong after Task 3 and you need to recreate the tables (extremely unlikely — they were empty), the original `CREATE TABLE` statements live in `supabase/migrations/20260412100000_platform_migration_readiness.sql`. You can copy them into a new forward migration. **Do not** edit the original migration file.
