# Rename `entities` → `related` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every mention of the polymorphic "entities" system to "related" across the Supabase database and the codebase, in one atomic flip.

**Architecture:** One new migration renames enums/tables/columns (explicit) and constraints/indexes/policies (dynamic DO blocks), then drops and recreates the 6 affected plpgsql functions and their triggers with updated names and bodies. The codebase is renamed with ordered, word-boundary-aware perl substitutions (protecting `identity` and pre-existing `related*` identifiers), 3 files are `git mv`'d, and `types.ts`/`schema.md` are regenerated from the live DB and diffed against the mechanical rename as a cross-check.

**Tech Stack:** Supabase (Postgres, edge functions), React 18 + TypeScript + Vite, `scripts/run-sql.cjs` for live-DB queries.

**Spec:** `docs/superpowers/specs/2026-06-11-rename-entities-to-related-design.md`

**Verified live-DB inventory (2026-06-11):** 16 constraints, 26 indexes, 2 policies, 15 triggers, 6 functions, 2 enums contain/reference entity names. Zero views reference entity tables. Zero `ai_events.payload` rows contain `entity_id`/`entity_type` keys (no data migration needed).

---

### Task 1: Write the DB rename migration

**Files:**
- Create: `supabase/migrations/20260611120000_rename_entities_to_related.sql`

- [ ] **Step 1: Create the migration file with exactly this content**

```sql
-- Rename the polymorphic "entities" system to "related".
-- Companion codebase rename ships in the same deploy; the app is pre-production.
begin;

-- 1. Enums (values are unchanged; only the type names move)
alter type public.entity_type_enum rename to related_type_enum;
alter type public.entity_kind rename to related_kind;

-- 2. Tables
alter table public.entities rename to related;
alter table public.entity_addresses rename to related_addresses;
alter table public.entity_emails rename to related_emails;
alter table public.entity_phones rename to related_phones;
alter table public.entity_files rename to related_files;
alter table public.entity_followers rename to related_followers;
alter table public.entity_projects rename to related_projects;
alter table public.entity_orphans rename to related_orphans;

-- 3. Columns: every entity_id / entity_type / original_entity_* in public
do $$
declare r record;
begin
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name in ('entity_id', 'entity_type', 'original_entity_id', 'original_entity_type')
  loop
    execute format(
      'alter table public.%I rename column %I to %I',
      r.table_name, r.column_name, replace(r.column_name, 'entity', 'related')
    );
  end loop;
end $$;

-- 4. Constraints (renaming a constraint also renames its backing index)
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where connamespace = 'public'::regnamespace and conname like '%entit%'
  loop
    execute format(
      'alter table %s rename constraint %I to %I',
      r.tbl, r.conname,
      replace(replace(r.conname, 'entities', 'related'), 'entity', 'related')
    );
  end loop;
end $$;

-- 5. Remaining standalone indexes
do $$
declare r record;
begin
  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public' and indexname like '%entit%'
  loop
    execute format(
      'alter index public.%I rename to %I',
      r.indexname,
      replace(replace(r.indexname, 'entities', 'related'), 'entity', 'related')
    );
  end loop;
end $$;

-- 6. Policies (bodies survive table renames; only names need updating)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname ilike '%entit%'
  loop
    execute format(
      'alter policy %I on %I.%I rename to %I',
      r.policyname, r.schemaname, r.tablename,
      replace(replace(replace(replace(r.policyname,
        'entities', 'related'), 'entity_orphans', 'related_orphans'),
        'entity', 'related'), 'Entit', 'Relat')
    );
  end loop;
end $$;

-- 7. Functions & triggers. plpgsql bodies are stored as text and do NOT track
--    renames, so every function that mentions the old names is recreated.

-- 7a. updated_at touch trigger on the parent table
drop trigger if exists trg_entities_updated_at on public.related;
drop function if exists public.sync_entity_updated_at();

create function public.sync_related_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_related_updated_at
before update on public.related
for each row execute function public.sync_related_updated_at();

-- 7b. parent-row auto-create on source-table insert
drop trigger if exists trg_people_create_entity on public.people;
drop trigger if exists trg_companies_create_entity on public.companies;
drop trigger if exists trg_deals_create_entity on public.deals;
drop trigger if exists trg_lender_programs_create_entity on public.lender_programs;
drop function if exists public.create_parent_entity();

create function public.create_parent_related()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public.related_kind;
  v_name text;
  v_row jsonb;
begin
  if new.related_id is not null then
    return new;
  end if;

  v_row := to_jsonb(new);

  case tg_table_name
    when 'people' then
      v_kind := 'people';
      v_name := v_row->>'name';
    when 'companies' then
      v_kind := 'companies';
      v_name := v_row->>'company_name';
    when 'deals' then
      v_kind := 'deal';
      v_name := coalesce(v_row->>'opportunity_name', v_row->>'name', v_row->>'company_name');
    when 'lender_programs' then
      v_kind := 'lender_programs';
      v_name := coalesce(v_row->>'program_name', v_row->>'lender_name');
    else
      raise exception 'create_parent_related attached to unexpected table %', tg_table_name;
  end case;

  insert into public.related (kind, source_id, display_name)
  values (v_kind, new.id, v_name)
  on conflict (kind, source_id) do update set display_name = excluded.display_name
  returning id into new.related_id;

  return new;
end;
$$;

create trigger trg_people_create_related
before insert on public.people
for each row execute function public.create_parent_related();

create trigger trg_companies_create_related
before insert on public.companies
for each row execute function public.create_parent_related();

create trigger trg_deals_create_related
before insert on public.deals
for each row execute function public.create_parent_related();

create trigger trg_lender_programs_create_related
before insert on public.lender_programs
for each row execute function public.create_parent_related();

-- 7c. parent-row delete on source-table delete
drop trigger if exists trg_people_delete_entity on public.people;
drop trigger if exists trg_companies_delete_entity on public.companies;
drop trigger if exists trg_deals_delete_entity on public.deals;
drop trigger if exists trg_lender_programs_delete_entity on public.lender_programs;
drop function if exists public.delete_parent_entity();

create function public.delete_parent_related()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.related where id = old.related_id;
  return old;
end;
$$;

create trigger trg_people_delete_related
after delete on public.people
for each row execute function public.delete_parent_related();

create trigger trg_companies_delete_related
after delete on public.companies
for each row execute function public.delete_parent_related();

create trigger trg_deals_delete_related
after delete on public.deals
for each row execute function public.delete_parent_related();

create trigger trg_lender_programs_delete_related
after delete on public.lender_programs
for each row execute function public.delete_parent_related();

-- 7d. child-table related_type sync
drop trigger if exists trg_entity_emails_sync_type on public.related_emails;
drop trigger if exists trg_entity_phones_sync_type on public.related_phones;
drop trigger if exists trg_entity_addresses_sync_type on public.related_addresses;
drop trigger if exists trg_entity_files_sync_type on public.related_files;
drop trigger if exists trg_entity_followers_sync_type on public.related_followers;
drop trigger if exists trg_entity_projects_sync_type on public.related_projects;
drop function if exists public.sync_child_entity_type();

create function public.sync_child_related_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public.related_kind;
begin
  select e.kind into v_kind
  from public.related e
  where e.id = new.related_id;

  if v_kind is null then
    raise exception 'No related row exists for related_id %', new.related_id;
  end if;

  new.related_type := v_kind::text::public.related_type_enum;
  return new;
end;
$$;

create trigger trg_related_emails_sync_type
before insert or update of related_id, related_type on public.related_emails
for each row execute function public.sync_child_related_type();

create trigger trg_related_phones_sync_type
before insert or update of related_id, related_type on public.related_phones
for each row execute function public.sync_child_related_type();

create trigger trg_related_addresses_sync_type
before insert or update of related_id, related_type on public.related_addresses
for each row execute function public.sync_child_related_type();

create trigger trg_related_files_sync_type
before insert or update of related_id, related_type on public.related_files
for each row execute function public.sync_child_related_type();

create trigger trg_related_followers_sync_type
before insert or update of related_id, related_type on public.related_followers
for each row execute function public.sync_child_related_type();

create trigger trg_related_projects_sync_type
before insert or update of related_id, related_type on public.related_projects
for each row execute function public.sync_child_related_type();

-- 7e. cleanup_deal_polymorphic_children: name unchanged (no "entity" in it),
--     body rewritten for the new enum and column names. create or replace
--     keeps the function OID, so its existing triggers stay attached.
create or replace function public.cleanup_deal_polymorphic_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_type_val public.related_type_enum;
begin
  related_type_val := TG_ARGV[0]::public.related_type_enum;

  delete from public.activities        where related_id = old.id and related_type = related_type_val;
  delete from public.activity_comments where lead_id = old.id;

  return old;
end $$;

-- 7f. log_deal_stage_change: name unchanged, body rewritten.
create or replace function public.log_deal_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_stage_name text;
  new_stage_name text;
  actor_name text;
  related_type_val public.related_type_enum;
begin
  if old.stage_id is distinct from new.stage_id then
    related_type_val := TG_ARGV[0]::public.related_type_enum;

    select name into old_stage_name from public.pipeline_stages where id = old.stage_id;
    select name into new_stage_name from public.pipeline_stages where id = new.stage_id;
    select coalesce(name, email) into actor_name from public.users where id = auth.uid();

    insert into public.activities (related_id, related_type, activity_type, title, content, created_by)
    values (
      new.id,
      related_type_val,
      'stage_change',
      'Stage changed',
      format(
        'Stage moved from %s to %s',
        coalesce(old_stage_name, 'none'),
        coalesce(new_stage_name, 'none')
      ),
      coalesce(actor_name, 'System')
    );

    new.stage_changed_at := now();
  end if;

  return new;
end $$;

commit;
```

- [ ] **Step 2: Commit the migration file (not yet pushed)**

```bash
git add supabase/migrations/20260611120000_rename_entities_to_related.sql
git commit -m "feat(db): add migration renaming entities system to related"
```

---

### Task 2: Codebase rename (script + file moves)

**Files:**
- Modify: all `*.ts`/`*.tsx` under `src/` and `supabase/functions/`, `CLAUDE.md` files, `scripts/` (excluding `supabase/migrations/**` and `schema.md`)
- Rename: `src/lib/entityRefs.ts` → `src/lib/relatedRefs.ts`
- Rename: `src/components/admin/files/EntityFilesSection.tsx` → `src/components/admin/files/RelatedFilesSection.tsx`
- Rename: `src/components/admin/shared/EntityCallHistorySection.tsx` → `src/components/admin/shared/RelatedCallHistorySection.tsx`

Note: `src/integrations/supabase/types.ts` IS included in the mechanical rename. It gets regenerated from the live DB in Task 5 and diffed against this mechanical version as a cross-check.

- [ ] **Step 1: Capture the pre-rename baseline (used for the UI-string review in Task 3)**

```bash
cd /Users/ilanfridman/trusted-deal-navigator
grep -rnE '\b[Ee]ntit(y|ies)\b' src --include='*.tsx' | grep -vE 'entity_|entityType|entityId|entityName|entityRef|entityLabel|entityEmails|entityContacts|entityTypeValue|entityKind' > /tmp/entity-ui-strings-before.txt
wc -l /tmp/entity-ui-strings-before.txt
```

Expected: a few dozen lines — these are bare-word "entity/entities" usages (comments, UI strings, variable names) to re-review after the rename.

- [ ] **Step 2: Run the ordered, word-boundary rename**

The `\b` before `entity` makes `identity` (Twilio) unmatchable — `identity` ends with the substring `entity` but has no word boundary before it. Pre-existing `related`, `relatedTo`, `related_to`, `relatedPeople` identifiers contain no `entity` token and are untouched.

```bash
cd /Users/ilanfridman/trusted-deal-navigator
FILES=$( { grep -rlE 'entit|Entit' src supabase/functions scripts --include='*.ts' --include='*.tsx' --include='*.cjs' --include='*.sql' --include='*.md' 2>/dev/null; find . -name 'CLAUDE.md' -not -path './node_modules/*'; } | sort -u | grep -v '^supabase/migrations' | grep -v '^./schema.md' | grep -v 'docs/superpowers' )
echo "$FILES" | wc -l
perl -pi -e '
  s/\bentity_/related_/g;
  s/\bentities\b/related/g;
  s/\bEntities\b/Related/g;
  s/\bentity\b/related/g;
  s/\bentity([A-Z])/related$1/g;
  s/\bEntity\b/Related/g;
  s/\bEntity([A-Z_])/Related$1/g;
' $FILES
```

(`scripts/seed/**` and `scripts/*.cjs` are included because seed/dev SQL may reference the renamed tables. `supabase/migrations` and `docs/superpowers` are explicitly excluded — historical migrations and the spec keep their original text.)

- [ ] **Step 3: Verify zero leftovers outside excluded paths**

```bash
grep -rnE '\b[Ee]ntit' src supabase/functions scripts CLAUDE.md 2>/dev/null | grep -v 'supabase/migrations' || echo "CLEAN"
```

Expected: `CLEAN`. If any line appears, it is an unusual casing/compound the rules missed — fix it manually with the same `entity→related` mapping.

- [ ] **Step 4: Rename the three files**

```bash
git mv src/lib/entityRefs.ts src/lib/relatedRefs.ts
git mv src/components/admin/files/EntityFilesSection.tsx src/components/admin/files/RelatedFilesSection.tsx
git mv src/components/admin/shared/EntityCallHistorySection.tsx src/components/admin/shared/RelatedCallHistorySection.tsx
```

Import paths inside files were already rewritten by Step 2 (`entityRefs` → `relatedRefs`, `EntityFilesSection` → `RelatedFilesSection`, `EntityCallHistorySection` → `RelatedCallHistorySection`).

---

### Task 3: Fix collisions and UI-string grammar, verify build

**Files:**
- Modify: whatever `npm run build` flags (expected: scopes that now declare `related` twice)

- [ ] **Step 1: Build and fix redeclaration collisions**

```bash
npm run build 2>&1 | tail -40
```

Expected failure mode: TypeScript errors like `Cannot redeclare block-scoped variable 'related'` or `Duplicate identifier 'related'` in files that already used a `related` variable (pre-existing usages: `related`, `relatedPeople`, `relatedDeals`, `relatedTo`). For each collision, rename the **newly-renamed** variable (the one that was `entities`/`entity`) to a scoped name like `relatedRecords` / `relatedRecord` — never touch the pre-existing `related*` identifier. Re-run until the build passes.

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: passes (or only pre-existing warnings — compare with `git stash; npm run lint; git stash pop` if unsure).

- [ ] **Step 3: UI-string grammar pass**

For each file listed in `/tmp/entity-ui-strings-before.txt`, inspect the renamed line in the working tree. Identifiers keep the plain swap. **User-visible strings** (JSX text, `toast(...)`, `placeholder=`, `title=`, `aria-label`, confirm dialogs) must read as English: bare "related" in a sentence becomes "related record" / "related records" (e.g. `Delete this related?` → `Delete this related record?`; `No related found` → `No related records found`).

```bash
while IFS=: read -r f line _; do echo "── $f:$line"; sed -n "${line}p" "$f"; done < /tmp/entity-ui-strings-before.txt
```

- [ ] **Step 4: Rebuild after string edits, then commit**

```bash
npm run build 2>&1 | tail -5
git add -A
git commit -m "refactor: rename entities system to related across codebase"
```

---

### Task 4: Push the migration and verify the live DB

- [ ] **Step 1: Push**

```bash
npm run db:push
```

Expected: `20260611120000_rename_entities_to_related.sql` applied without error. From this moment until Task 6 completes, the deployed app/edge functions reference old names — acceptable pre-prod; proceed without delay.

- [ ] **Step 2: Verify zero entity-named objects remain**

```bash
node scripts/run-sql.cjs --sql "
select 'constraint' as obj, conname as name from pg_constraint where connamespace='public'::regnamespace and conname ~ 'entit'
union all select 'index', indexname from pg_indexes where schemaname='public' and indexname ~ 'entit'
union all select 'policy', policyname from pg_policies where schemaname='public' and policyname ~* 'entit'
union all select 'trigger', tgname from pg_trigger where not tgisinternal and tgname ~ 'entit'
union all select 'function', proname from pg_proc where pronamespace='public'::regnamespace and proname ~ 'entit'
union all select 'enum', typname from pg_type where typnamespace='public'::regnamespace and typname ~ 'entit' and typtype='e'
union all select 'column', table_name||'.'||column_name from information_schema.columns where table_schema='public' and column_name ~ 'entit'
union all select 'table', table_name from information_schema.tables where table_schema='public' and table_name ~ 'entit'
union all select 'func-body', proname from pg_proc where pronamespace='public'::regnamespace and prosrc ~ '(entities|entity_|entity_type_enum|entity_kind)';"
```

Expected: `SELECT (0 rows)`.

- [ ] **Step 3: SQL smoke test — triggers fire end-to-end**

```bash
node scripts/run-sql.cjs --sql "
begin;
insert into public.people (name) values ('__rename_smoke__');
select p.related_id is not null as has_related_id, r.kind, r.display_name
from public.people p join public.related r on r.id = p.related_id
where p.name = '__rename_smoke__';
delete from public.people where name = '__rename_smoke__';
select count(*) as orphaned from public.related where display_name = '__rename_smoke__';
commit;"
```

Expected: `has_related_id: true`, `kind: 'people'`, `display_name: '__rename_smoke__'`, then `orphaned: '0'`. This exercises `create_parent_related()` and `delete_parent_related()`. (If the insert fails on an unrelated NOT NULL column, add the minimum required fields per the error message and retry.)

---

### Task 5: Regenerate types.ts and schema.md, cross-check

**Files:**
- Regenerate: `src/integrations/supabase/types.ts`, `schema.md`

- [ ] **Step 1: Regenerate types from the live DB and diff against the mechanical rename**

```bash
cp src/integrations/supabase/types.ts /tmp/types.mechanical.ts
npx supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts
diff /tmp/types.mechanical.ts src/integrations/supabase/types.ts | head -40
```

Expected: empty or near-empty diff (formatting/ordering only). Any **name** difference means the migration and the code rename disagree — stop and reconcile before continuing. (If `--linked` errors, link first: `npx supabase link`.)

- [ ] **Step 2: Regenerate schema.md**

```bash
npm run generate-schema
grep -c "entit" schema.md || echo "0 — clean"
```

Expected: `0 — clean`.

- [ ] **Step 3: Final build against regenerated types, then commit**

```bash
npm run build 2>&1 | tail -5
git add -A
git commit -m "chore(db): regenerate types and schema docs after entities → related rename"
```

---

### Task 6: Deploy edge functions

- [ ] **Step 1: Deploy**

```bash
npm run functions:deploy
```

Expected: all functions deploy successfully. This closes the breakage window opened in Task 4.

---

### Task 7: App smoke test

No automated test suite exists; this is the manual verification pass from the spec.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk the smoke checklist** (use the browser, or the agent-browser/verify skill)

1. Create a person, a company, and a deal — exercises `create_parent_related()` trigger via the UI insert path
2. Open a deal/person detail panel — Related sidebar, files section (`RelatedFilesSection`), call history (`RelatedCallHistorySection`) all load without console errors
3. Gmail compose from a lead — exercises the renamed FK embed hint (`related!people_related_id_fkey(related_emails(...))` in `useGmailLogic.ts`)
4. Create a task linked to a person — exercises `tasks.related_id`/`related_type`
5. Delete a deal, then undo — exercises the undo flow and `cleanup_deal_polymorphic_children()`
6. Move a deal between pipeline stages — exercises `log_deal_stage_change()`

- [ ] **Step 3: Report results**

Any failure: debug with `node scripts/run-sql.cjs` + browser console before claiming completion. All green: done.
