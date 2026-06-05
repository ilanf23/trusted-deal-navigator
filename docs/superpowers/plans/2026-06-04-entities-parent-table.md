# Entities Parent Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace loose polymorphic `entity_type + entity_id` references with a canonical `entities` parent table so shared entity child records have a real foreign-key target.

**Architecture:** Add `public.entities` as the parent record for CRM people, companies, deals, and lender programs. Backfill each parent table with an `entity_id`, update shared child tables to reference `entities.id`, then add FKs, consistency triggers, generated types, and UI updates that pass canonical entity IDs instead of record IDs.

**Tech Stack:** Supabase Postgres migrations, React 18, TypeScript, Supabase JS, TanStack Query.

**GitHub Issue:** https://github.com/ilanf23/trusted-deal-navigator/issues/122

---

## Scope

This plan implements the long-term schema direction selected by Ilan: create a real `entities` parent table. It does not merge `people` into `users`; `people` remains the CRM contact table for lawyers, partners, borrower principals, lender reps, referral partners, and other external relationships.

The plan treats the existing `entity_*` tables as separate categories:

- Shared child data to migrate behind a real FK: `entity_emails`, `entity_phones`, `entity_addresses`, `entity_files`, `entity_followers`, `entity_projects`.
- Deal contact snapshots to rename/model separately: `entity_contacts`.
- Real junctions that should remain explicit: `company_people`, `deal_people`, `project_people`.

## Files

- Create: `supabase/migrations/20260605090000_create_entities_parent_table.sql`
- Create: `supabase/migrations/20260605093000_migrate_entity_children_to_entities.sql`
- Create: `supabase/migrations/20260605100000_harden_entity_child_integrity.sql`
- Create: `supabase/migrations/20260605103000_rename_entity_contacts_to_deal_contacts.sql`
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/lib/entityRefs.ts`
- Modify: `src/components/admin/PeopleDetailPanel.tsx`
- Modify: `src/components/admin/PeopleExpandedView.tsx`
- Modify: `src/pages/admin/People.tsx`
- Modify: `src/components/admin/CompanyDetailPanel.tsx`
- Modify: `src/components/admin/CompanyExpandedView.tsx`
- Modify: `src/pages/admin/Companies.tsx`
- Modify: `src/components/admin/PipelineDetailPanel.tsx`
- Modify: `src/components/admin/PipelineExpandedView.tsx`
- Modify: `src/components/admin/UnderwritingDetailPanel.tsx`
- Modify: `src/components/admin/UnderwritingExpandedView.tsx`
- Modify: `src/components/admin/LenderManagementExpandedView.tsx`
- Modify: `src/components/admin/LeadDetailDialog.tsx`
- Modify: `src/components/admin/ExpandedLeftColumn.tsx`
- Modify: `src/components/admin/shared/LeadRelatedSidebar.tsx`
- Modify: `src/components/admin/ProjectDetailPanel.tsx`
- Modify: `src/components/admin/ProjectExpandedView.tsx`
- Modify: `src/components/admin/LenderExpandedView.tsx`
- Modify: `src/components/admin/files/AddFileDialog.tsx`
- Modify: `src/components/admin/files/EntityFilesSection.tsx`
- Modify: `src/hooks/useAllPipelineLeads.ts`
- Modify: `src/hooks/useGmailLogic.ts`
- Modify: `src/hooks/usePipelineMutations.ts`
- Modify: `supabase/functions/twilio-inbound/index.ts`
- Modify: `supabase/functions/twilio-call-history/index.ts`
- Modify: `schema.md`

---

### Task 1: Preflight Data Audit

**Files:**
- No file changes.

- [ ] **Step 1: Confirm current GitHub issue**

Run:

```bash
gh issue view 122 --repo ilanf23/trusted-deal-navigator --json number,title,state,url
```

Expected: issue `122` is open and URL is `https://github.com/ilanf23/trusted-deal-navigator/issues/122`.

- [ ] **Step 2: Run live orphan audit before writing migrations**

Run this read-only SQL against the Supabase branch that will receive the migration first:

```sql
with parent_entities as (
  select 'people'::text as entity_type, id from public.people
  union all
  select 'companies'::text as entity_type, id from public.companies
  union all
  select 'deal'::text as entity_type, id from public.deals
  union all
  select 'lender_programs'::text as entity_type, id from public.lender_programs
),
child_rows as (
  select 'entity_emails'::text as table_name, id, entity_type::text, entity_id from public.entity_emails
  union all
  select 'entity_phones'::text, id, entity_type::text, entity_id from public.entity_phones
  union all
  select 'entity_addresses'::text, id, entity_type::text, entity_id from public.entity_addresses
  union all
  select 'entity_files'::text, id, entity_type::text, entity_id from public.entity_files
  union all
  select 'entity_followers'::text, id, entity_type::text, entity_id from public.entity_followers
  union all
  select 'entity_projects'::text, id, entity_type::text, entity_id from public.entity_projects
)
select
  c.table_name,
  c.entity_type,
  count(*) filter (where p.id is not null) as valid_rows,
  count(*) filter (where p.id is null) as orphan_rows
from child_rows c
left join parent_entities p
  on p.entity_type = c.entity_type
 and p.id = c.entity_id
group by c.table_name, c.entity_type
order by c.table_name, c.entity_type;
```

Expected: every table/type pair has counts recorded. `orphan_rows > 0` is acceptable at this stage, but those rows must be quarantined in Task 3 before adding FKs.

- [ ] **Step 3: Confirm parent ID collision risk**

Run:

```sql
with all_parent_ids as (
  select 'people'::text as source_table, id from public.people
  union all
  select 'companies'::text, id from public.companies
  union all
  select 'deals'::text, id from public.deals
  union all
  select 'lender_programs'::text, id from public.lender_programs
)
select id, array_agg(source_table order by source_table) as source_tables, count(*) as occurrences
from all_parent_ids
group by id
having count(*) > 1;
```

Expected: zero rows. If this returns rows, stop before migration because the data has duplicate UUIDs across parent tables and the backfill must use generated entity IDs only.

- [ ] **Step 4: Commit nothing**

No commit is made in this task because it is audit-only.

---

### Task 2: Create Entities Parent Table

**Files:**
- Create: `supabase/migrations/20260605090000_create_entities_parent_table.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260605090000_create_entities_parent_table.sql`:

```sql
begin;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'entity_kind') then
    create type public.entity_kind as enum ('people', 'companies', 'deal', 'lender_programs');
  end if;
end $$;

alter type public.entity_type_enum add value if not exists 'lender_programs';

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  kind public.entity_kind not null,
  source_id uuid not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entities_kind_source_id_key unique (kind, source_id)
);

create index if not exists entities_kind_source_id_idx on public.entities (kind, source_id);
create index if not exists entities_source_id_idx on public.entities (source_id);

alter table public.entities enable row level security;

drop policy if exists "Admins and super admins can manage entities" on public.entities;
create policy "Admins and super admins can manage entities"
on public.entities
for all
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
);

alter table public.people add column if not exists entity_id uuid;
alter table public.companies add column if not exists entity_id uuid;
alter table public.deals add column if not exists entity_id uuid;
alter table public.lender_programs add column if not exists entity_id uuid;

insert into public.entities (kind, source_id, display_name, created_at, updated_at)
select 'people'::public.entity_kind, p.id, p.name, p.created_at, p.updated_at
from public.people p
on conflict (kind, source_id) do update
set display_name = excluded.display_name,
    updated_at = now();

insert into public.entities (kind, source_id, display_name, created_at, updated_at)
select 'companies'::public.entity_kind, c.id, c.company_name, c.created_at, c.updated_at
from public.companies c
on conflict (kind, source_id) do update
set display_name = excluded.display_name,
    updated_at = now();

insert into public.entities (kind, source_id, display_name, created_at, updated_at)
select 'deal'::public.entity_kind, d.id, coalesce(d.opportunity_name, d.name, d.company_name), d.created_at, d.updated_at
from public.deals d
on conflict (kind, source_id) do update
set display_name = excluded.display_name,
    updated_at = now();

insert into public.entities (kind, source_id, display_name, created_at, updated_at)
select 'lender_programs'::public.entity_kind, lp.id, lp.name, lp.created_at, lp.updated_at
from public.lender_programs lp
on conflict (kind, source_id) do update
set display_name = excluded.display_name,
    updated_at = now();

update public.people p
set entity_id = e.id
from public.entities e
where e.kind = 'people'
  and e.source_id = p.id
  and p.entity_id is distinct from e.id;

update public.companies c
set entity_id = e.id
from public.entities e
where e.kind = 'companies'
  and e.source_id = c.id
  and c.entity_id is distinct from e.id;

update public.deals d
set entity_id = e.id
from public.entities e
where e.kind = 'deal'
  and e.source_id = d.id
  and d.entity_id is distinct from e.id;

update public.lender_programs lp
set entity_id = e.id
from public.entities e
where e.kind = 'lender_programs'
  and e.source_id = lp.id
  and lp.entity_id is distinct from e.id;

alter table public.people alter column entity_id set not null;
alter table public.companies alter column entity_id set not null;
alter table public.deals alter column entity_id set not null;
alter table public.lender_programs alter column entity_id set not null;

create unique index if not exists people_entity_id_key on public.people (entity_id);
create unique index if not exists companies_entity_id_key on public.companies (entity_id);
create unique index if not exists deals_entity_id_key on public.deals (entity_id);
create unique index if not exists lender_programs_entity_id_key on public.lender_programs (entity_id);

alter table public.people
  drop constraint if exists people_entity_id_fkey,
  add constraint people_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete restrict;

alter table public.companies
  drop constraint if exists companies_entity_id_fkey,
  add constraint companies_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete restrict;

alter table public.deals
  drop constraint if exists deals_entity_id_fkey,
  add constraint deals_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete restrict;

alter table public.lender_programs
  drop constraint if exists lender_programs_entity_id_fkey,
  add constraint lender_programs_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete restrict;

create or replace function public.sync_entity_updated_at()
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

drop trigger if exists trg_entities_updated_at on public.entities;
create trigger trg_entities_updated_at
before update on public.entities
for each row execute function public.sync_entity_updated_at();

commit;
```

- [ ] **Step 2: Push migration to a Supabase branch**

Run:

```bash
npm run db:push
```

Expected: migration applies without FK errors and without orphan errors because child-table FKs are not added yet.

- [ ] **Step 3: Verify parent rows**

Run:

```sql
select kind, count(*) from public.entities group by kind order by kind;

select 'people_missing_entity_id' as check_name, count(*) from public.people where entity_id is null
union all
select 'companies_missing_entity_id', count(*) from public.companies where entity_id is null
union all
select 'deals_missing_entity_id', count(*) from public.deals where entity_id is null
union all
select 'lender_programs_missing_entity_id', count(*) from public.lender_programs where entity_id is null;
```

Expected: each missing count is `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260605090000_create_entities_parent_table.sql
git commit -m "feat(db): add canonical entities parent table"
```

---

### Task 3: Migrate Shared Child Rows To Entity IDs

**Files:**
- Create: `supabase/migrations/20260605093000_migrate_entity_children_to_entities.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260605093000_migrate_entity_children_to_entities.sql`:

```sql
begin;

create table if not exists public.entity_orphans (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  original_entity_type text,
  original_entity_id uuid not null,
  payload jsonb not null,
  reason text not null,
  quarantined_at timestamptz not null default now()
);

create index if not exists entity_orphans_source_table_idx on public.entity_orphans (source_table);
create index if not exists entity_orphans_original_entity_idx on public.entity_orphans (original_entity_type, original_entity_id);

alter table public.entity_orphans enable row level security;

drop policy if exists "Admins and super admins can manage entity_orphans" on public.entity_orphans;
create policy "Admins and super admins can manage entity_orphans"
on public.entity_orphans
for all
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
);

update public.entity_emails set entity_type = 'deal' where entity_type in ('pipeline', 'potential', 'underwriting', 'lender_management');
update public.entity_phones set entity_type = 'deal' where entity_type in ('pipeline', 'potential', 'underwriting', 'lender_management');
update public.entity_addresses set entity_type = 'deal' where entity_type in ('pipeline', 'potential', 'underwriting', 'lender_management');
update public.entity_files set entity_type = 'deal' where entity_type in ('pipeline', 'potential', 'underwriting', 'lender_management');
update public.entity_followers set entity_type = 'deal' where entity_type in ('pipeline', 'potential', 'underwriting', 'lender_management');
update public.entity_projects set entity_type = 'deal' where entity_type in ('pipeline', 'potential', 'underwriting', 'lender_management');

insert into public.entity_orphans (source_table, source_id, original_entity_type, original_entity_id, payload, reason)
select 'entity_emails', ee.id, ee.entity_type::text, ee.entity_id, to_jsonb(ee), 'No matching parent entity before entity_id migration'
from public.entity_emails ee
left join public.entities e on e.kind::text = ee.entity_type::text and e.source_id = ee.entity_id
where e.id is null
on conflict do nothing;

insert into public.entity_orphans (source_table, source_id, original_entity_type, original_entity_id, payload, reason)
select 'entity_phones', ep.id, ep.entity_type::text, ep.entity_id, to_jsonb(ep), 'No matching parent entity before entity_id migration'
from public.entity_phones ep
left join public.entities e on e.kind::text = ep.entity_type::text and e.source_id = ep.entity_id
where e.id is null
on conflict do nothing;

insert into public.entity_orphans (source_table, source_id, original_entity_type, original_entity_id, payload, reason)
select 'entity_addresses', ea.id, ea.entity_type::text, ea.entity_id, to_jsonb(ea), 'No matching parent entity before entity_id migration'
from public.entity_addresses ea
left join public.entities e on e.kind::text = ea.entity_type::text and e.source_id = ea.entity_id
where e.id is null
on conflict do nothing;

insert into public.entity_orphans (source_table, source_id, original_entity_type, original_entity_id, payload, reason)
select 'entity_files', ef.id, ef.entity_type::text, ef.entity_id, to_jsonb(ef), 'No matching parent entity before entity_id migration'
from public.entity_files ef
left join public.entities e on e.kind::text = ef.entity_type::text and e.source_id = ef.entity_id
where e.id is null
on conflict do nothing;

insert into public.entity_orphans (source_table, source_id, original_entity_type, original_entity_id, payload, reason)
select 'entity_followers', ef.id, ef.entity_type::text, ef.entity_id, to_jsonb(ef), 'No matching parent entity before entity_id migration'
from public.entity_followers ef
left join public.entities e on e.kind::text = ef.entity_type::text and e.source_id = ef.entity_id
where e.id is null
on conflict do nothing;

insert into public.entity_orphans (source_table, source_id, original_entity_type, original_entity_id, payload, reason)
select 'entity_projects', ep.id, ep.entity_type::text, ep.entity_id, to_jsonb(ep), 'No matching parent entity before entity_id migration'
from public.entity_projects ep
left join public.entities e on e.kind::text = ep.entity_type::text and e.source_id = ep.entity_id
where e.id is null
on conflict do nothing;

delete from public.entity_emails ee
using public.entity_orphans o
where o.source_table = 'entity_emails' and o.source_id = ee.id;

delete from public.entity_phones ep
using public.entity_orphans o
where o.source_table = 'entity_phones' and o.source_id = ep.id;

delete from public.entity_addresses ea
using public.entity_orphans o
where o.source_table = 'entity_addresses' and o.source_id = ea.id;

delete from public.entity_files ef
using public.entity_orphans o
where o.source_table = 'entity_files' and o.source_id = ef.id;

delete from public.entity_followers ef
using public.entity_orphans o
where o.source_table = 'entity_followers' and o.source_id = ef.id;

delete from public.entity_projects ep
using public.entity_orphans o
where o.source_table = 'entity_projects' and o.source_id = ep.id;

update public.entity_emails ee
set entity_id = e.id
from public.entities e
where e.kind::text = ee.entity_type::text
  and e.source_id = ee.entity_id;

update public.entity_phones ep
set entity_id = e.id
from public.entities e
where e.kind::text = ep.entity_type::text
  and e.source_id = ep.entity_id;

update public.entity_addresses ea
set entity_id = e.id
from public.entities e
where e.kind::text = ea.entity_type::text
  and e.source_id = ea.entity_id;

update public.entity_files ef
set entity_id = e.id
from public.entities e
where e.kind::text = ef.entity_type::text
  and e.source_id = ef.entity_id;

update public.entity_followers ef
set entity_id = e.id
from public.entities e
where e.kind::text = ef.entity_type::text
  and e.source_id = ef.entity_id;

update public.entity_projects ep
set entity_id = e.id
from public.entities e
where e.kind::text = ep.entity_type::text
  and e.source_id = ep.entity_id;

commit;
```

- [ ] **Step 2: Push migration to branch**

Run:

```bash
npm run db:push
```

Expected: migration applies. Orphan rows are copied into `entity_orphans` and removed from child tables.

- [ ] **Step 3: Verify no migrated child row points outside `entities`**

Run:

```sql
with child_rows as (
  select 'entity_emails'::text as table_name, id, entity_id from public.entity_emails
  union all
  select 'entity_phones'::text, id, entity_id from public.entity_phones
  union all
  select 'entity_addresses'::text, id, entity_id from public.entity_addresses
  union all
  select 'entity_files'::text, id, entity_id from public.entity_files
  union all
  select 'entity_followers'::text, id, entity_id from public.entity_followers
  union all
  select 'entity_projects'::text, id, entity_id from public.entity_projects
)
select c.table_name, count(*) as missing_entities
from child_rows c
left join public.entities e on e.id = c.entity_id
where e.id is null
group by c.table_name
order by c.table_name;
```

Expected: zero rows.

- [ ] **Step 4: Review quarantined rows**

Run:

```sql
select source_table, original_entity_type, count(*) as quarantined_rows
from public.entity_orphans
group by source_table, original_entity_type
order by source_table, original_entity_type;
```

Expected: counts match Task 1 orphan counts. Keep these rows for manual review instead of silently deleting historical data.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260605093000_migrate_entity_children_to_entities.sql
git commit -m "feat(db): migrate entity children to canonical entity ids"
```

---

### Task 4: Add Child FKs, Indexes, And Consistency Triggers

**Files:**
- Create: `supabase/migrations/20260605100000_harden_entity_child_integrity.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260605100000_harden_entity_child_integrity.sql`:

```sql
begin;

create index if not exists entity_emails_entity_id_idx on public.entity_emails (entity_id);
create index if not exists entity_phones_entity_id_idx on public.entity_phones (entity_id);
create index if not exists entity_addresses_entity_id_idx on public.entity_addresses (entity_id);
create index if not exists entity_files_entity_id_idx on public.entity_files (entity_id);
create index if not exists entity_followers_entity_id_idx on public.entity_followers (entity_id);
create index if not exists entity_projects_entity_id_idx on public.entity_projects (entity_id);

create index if not exists entity_emails_type_entity_idx on public.entity_emails (entity_type, entity_id);
create index if not exists entity_phones_type_entity_idx on public.entity_phones (entity_type, entity_id);
create index if not exists entity_addresses_type_entity_idx on public.entity_addresses (entity_type, entity_id);
create index if not exists entity_files_type_entity_idx on public.entity_files (entity_type, entity_id);
create index if not exists entity_followers_type_entity_idx on public.entity_followers (entity_type, entity_id);
create index if not exists entity_projects_type_entity_idx on public.entity_projects (entity_type, entity_id);

alter table public.entity_emails
  drop constraint if exists entity_emails_entity_id_fkey,
  add constraint entity_emails_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete cascade;

alter table public.entity_phones
  drop constraint if exists entity_phones_entity_id_fkey,
  add constraint entity_phones_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete cascade;

alter table public.entity_addresses
  drop constraint if exists entity_addresses_entity_id_fkey,
  add constraint entity_addresses_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete cascade;

alter table public.entity_files
  drop constraint if exists entity_files_entity_id_fkey,
  add constraint entity_files_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete cascade;

alter table public.entity_followers
  drop constraint if exists entity_followers_entity_id_fkey,
  add constraint entity_followers_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete cascade;

alter table public.entity_projects
  drop constraint if exists entity_projects_entity_id_fkey,
  add constraint entity_projects_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete cascade;

create or replace function public.sync_child_entity_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public.entity_kind;
begin
  select e.kind into v_kind
  from public.entities e
  where e.id = new.entity_id;

  if v_kind is null then
    raise exception 'No entities row exists for entity_id %', new.entity_id;
  end if;

  new.entity_type := v_kind::text::public.entity_type_enum;
  return new;
end;
$$;

drop trigger if exists trg_entity_emails_sync_type on public.entity_emails;
create trigger trg_entity_emails_sync_type
before insert or update of entity_id, entity_type on public.entity_emails
for each row execute function public.sync_child_entity_type();

drop trigger if exists trg_entity_phones_sync_type on public.entity_phones;
create trigger trg_entity_phones_sync_type
before insert or update of entity_id, entity_type on public.entity_phones
for each row execute function public.sync_child_entity_type();

drop trigger if exists trg_entity_addresses_sync_type on public.entity_addresses;
create trigger trg_entity_addresses_sync_type
before insert or update of entity_id, entity_type on public.entity_addresses
for each row execute function public.sync_child_entity_type();

drop trigger if exists trg_entity_files_sync_type on public.entity_files;
create trigger trg_entity_files_sync_type
before insert or update of entity_id, entity_type on public.entity_files
for each row execute function public.sync_child_entity_type();

drop trigger if exists trg_entity_followers_sync_type on public.entity_followers;
create trigger trg_entity_followers_sync_type
before insert or update of entity_id, entity_type on public.entity_followers
for each row execute function public.sync_child_entity_type();

drop trigger if exists trg_entity_projects_sync_type on public.entity_projects;
create trigger trg_entity_projects_sync_type
before insert or update of entity_id, entity_type on public.entity_projects
for each row execute function public.sync_child_entity_type();

commit;
```

- [ ] **Step 2: Push migration to branch**

Run:

```bash
npm run db:push
```

Expected: all FK constraints are created successfully.

- [ ] **Step 3: Verify FK indexes**

Run:

```sql
select
  conrelid::regclass as table_name,
  a.attname as fk_column
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f'
  and conrelid::regclass::text in (
    'entity_emails',
    'entity_phones',
    'entity_addresses',
    'entity_files',
    'entity_followers',
    'entity_projects'
  )
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid and a.attnum = any(i.indkey)
  );
```

Expected: zero rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260605100000_harden_entity_child_integrity.sql
git commit -m "feat(db): enforce entity child referential integrity"
```

---

### Task 5: Rename And Re-model `entity_contacts`

**Files:**
- Create: `supabase/migrations/20260605103000_rename_entity_contacts_to_deal_contacts.sql`
- Modify: `src/components/admin/AddOpportunityDialog.tsx`
- Modify: `src/components/admin/PipelineDetailPanel.tsx`
- Modify: `src/components/admin/LeadDetailDialog.tsx`
- Modify: `src/components/admin/shared/LeadRelatedSidebar.tsx`
- Modify: `src/components/admin/ExpandedLeftColumn.tsx`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260605103000_rename_entity_contacts_to_deal_contacts.sql`:

```sql
begin;

alter table public.entity_contacts rename to deal_contacts;

alter table public.deal_contacts
  add column if not exists deal_id uuid;

update public.deal_contacts dc
set deal_id = e.source_id
from public.entities e
where e.kind = 'deal'
  and e.id = dc.entity_id
  and dc.deal_id is null;

delete from public.deal_contacts
where deal_id is null;

alter table public.deal_contacts alter column deal_id set not null;

alter table public.deal_contacts
  drop constraint if exists deal_contacts_deal_id_fkey,
  add constraint deal_contacts_deal_id_fkey foreign key (deal_id) references public.deals(id) on delete cascade;

create index if not exists deal_contacts_deal_id_idx on public.deal_contacts (deal_id);
create index if not exists deal_contacts_deal_primary_idx on public.deal_contacts (deal_id, is_primary);

comment on table public.deal_contacts is 'Free-text or copied contact snapshots attached to a deal. Canonical CRM person relationships live in deal_people.';

commit;
```

- [ ] **Step 2: Replace reads from `entity_contacts` with `deal_contacts`**

In the listed files, replace this pattern:

```ts
supabase
  .from('entity_contacts')
  .select('*')
  .eq('entity_id', lead.id)
  .eq('entity_type', 'deal')
```

with:

```ts
supabase
  .from('deal_contacts')
  .select('*')
  .eq('deal_id', lead.id)
```

When the local variable is named `leadId`, use:

```ts
supabase
  .from('deal_contacts')
  .select('*')
  .eq('deal_id', leadId)
```

- [ ] **Step 3: Replace inserts into `entity_contacts` with `deal_contacts`**

Replace this insert shape:

```ts
await supabase.from('entity_contacts').insert({
  entity_id: lead.id,
  entity_type: 'deal',
  name,
  title,
  email,
  phone,
  is_primary,
});
```

with:

```ts
await supabase.from('deal_contacts').insert({
  deal_id: lead.id,
  name,
  title,
  email,
  phone,
  is_primary,
});
```

- [ ] **Step 4: Replace updates/deletes**

Replace:

```ts
await supabase.from('entity_contacts').update({ name, title }).eq('id', contactId);
await supabase.from('entity_contacts').delete().eq('id', contactId);
```

with:

```ts
await supabase.from('deal_contacts').update({ name, title }).eq('id', contactId);
await supabase.from('deal_contacts').delete().eq('id', contactId);
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: build passes with no TypeScript errors after generated Supabase types are refreshed in Task 7.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260605103000_rename_entity_contacts_to_deal_contacts.sql src/components/admin/AddOpportunityDialog.tsx src/components/admin/PipelineDetailPanel.tsx src/components/admin/LeadDetailDialog.tsx src/components/admin/shared/LeadRelatedSidebar.tsx src/components/admin/ExpandedLeftColumn.tsx
git commit -m "refactor(db): model deal contact snapshots explicitly"
```

---

### Task 6: Add Entity Reference Helper And Update UI Callers

**Files:**
- Create: `src/lib/entityRefs.ts`
- Modify: listed React and hook files that pass `entityId` or query `entity_*`.

- [ ] **Step 1: Create helper**

Create `src/lib/entityRefs.ts`:

```ts
export type EntityKind = 'people' | 'companies' | 'deal' | 'lender_programs';

export interface EntityBackedRecord {
  id: string;
  entity_id: string;
}

export interface EntityRef {
  recordId: string;
  entityId: string;
  entityType: EntityKind;
}

export function entityRef(record: EntityBackedRecord, entityType: EntityKind): EntityRef {
  return {
    recordId: record.id,
    entityId: record.entity_id,
    entityType,
  };
}

export function requireEntityId(record: Partial<EntityBackedRecord>, label: string): string {
  if (!record.entity_id) {
    throw new Error(`${label} is missing entity_id`);
  }
  return record.entity_id;
}
```

- [ ] **Step 2: Update People entity child queries**

In `src/components/admin/PeopleDetailPanel.tsx` and `src/components/admin/PeopleExpandedView.tsx`, replace child-table filters that use `person.id` or `personId` as `entity_id` with `person.entity_id`.

Before:

```ts
await supabase.from('entity_emails').select('*').eq('entity_id', person.id).eq('entity_type', 'people');
```

After:

```ts
await supabase.from('entity_emails').select('*').eq('entity_id', person.entity_id).eq('entity_type', 'people');
```

For route pages that only have `personId`, first fetch the person row and then use:

```ts
const personEntityId = requireEntityId(person, 'person');
```

- [ ] **Step 3: Update People inserts**

Replace:

```ts
await supabase.from('entity_phones').insert({
  entity_id: person.id,
  entity_type: 'people',
  phone_number: phone,
  phone_type: newPhoneType,
});
```

with:

```ts
await supabase.from('entity_phones').insert({
  entity_id: person.entity_id,
  entity_type: 'people',
  phone_number: phone,
  phone_type: newPhoneType,
});
```

- [ ] **Step 4: Update Companies entity child queries**

In `src/hooks/useAllPipelineLeads.ts`, build the company lookup by `company.entity_id` instead of `company.id`.

Replace the map key assignment:

```ts
phoneByCompany.set(r.entity_id, arr);
emailByCompany.set(r.entity_id, arr);
```

with keys compared against `c.entity_id`:

```ts
const phones = phoneByCompany.get(c.entity_id) ?? [];
const emails = emailByCompany.get(c.entity_id) ?? [];
```

- [ ] **Step 5: Update Deal detail views**

In `PipelineDetailPanel`, `PipelineExpandedView`, `UnderwritingDetailPanel`, `UnderwritingExpandedView`, `LenderManagementExpandedView`, and `LeadDetailDialog`, replace deal child-table queries from:

```ts
.eq('entity_id', lead.id)
.eq('entity_type', 'deal')
```

to:

```ts
.eq('entity_id', lead.entity_id)
.eq('entity_type', 'deal')
```

For local variables named `leadId`, fetch the deal row including `entity_id` before querying child tables.

- [ ] **Step 6: Update file callers**

When rendering `EntityFilesSection`, pass the canonical entity ID:

```tsx
<EntityFilesSection entityId={person.entity_id} entityType="people" />
<EntityFilesSection entityId={company.entity_id} entityType="companies" />
<EntityFilesSection entityId={lead.entity_id} entityType="deal" />
<EntityFilesSection entityId={lenderProgram.entity_id} entityType="lender_programs" />
```

- [ ] **Step 7: Verify build**

Run:

```bash
npm run build
```

Expected: build passes after all entity child callers use canonical IDs.

- [ ] **Step 8: Commit**

```bash
git add src/lib/entityRefs.ts src/components/admin src/pages/admin src/hooks
git commit -m "refactor(ui): use canonical entity ids for shared child data"
```

---

### Task 7: Refresh Supabase Types And Schema Docs

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Modify: `schema.md`

- [ ] **Step 1: Generate schema documentation**

Run:

```bash
npm run generate-schema
```

Expected: `schema.md` includes `entities`, `entity_orphans`, `deal_contacts`, and FK relationships from shared child tables to `entities`.

- [ ] **Step 2: Generate Supabase TypeScript types**

Run the project standard type generation command. If no command exists in `package.json`, run:

```bash
npx supabase gen types typescript --project-id kpgrogjmvjauusdnnrln --schema public > src/integrations/supabase/types.ts
```

Expected: `types.ts` includes `entities`, `entity_kind`, parent-table `entity_id` columns, and `deal_contacts`.

- [ ] **Step 3: Verify build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add schema.md src/integrations/supabase/types.ts
git commit -m "chore(db): refresh schema docs and generated types"
```

---

### Task 8: Edge Function Updates

**Files:**
- Modify: `supabase/functions/twilio-inbound/index.ts`
- Modify: `supabase/functions/twilio-call-history/index.ts`

- [ ] **Step 1: Update phone lookup to resolve from canonical entities**

In `twilio-inbound`, keep direct `people.phone` fallback, but update `entity_phones` lookup to join through `entities`:

```ts
const { data: phoneMatch } = await sb
  .from('entity_phones')
  .select('entity_id, entities!inner(kind, source_id)')
  .ilike('phone_number', `%${normalized}`)
  .eq('entity_type', 'people')
  .limit(1)
  .maybeSingle();

if (phoneMatch?.entities?.source_id) {
  resolvedLeadId = phoneMatch.entities.source_id;
}
```

- [ ] **Step 2: Update call-history entity phone resolution**

In `twilio-call-history`, replace the person ID extraction from `entity_phones.entity_id` with `entities.source_id`:

```ts
const { data: ephones, error: ephonesErr } = await supabase
  .from('entity_phones')
  .select('entity_id, entity_type, phone_number, entities!inner(kind, source_id)')
  .eq('entity_type', 'people')
  .or(orClause);

const personIds = Array.from(
  new Set(
    (ephones ?? [])
      .map((e: any) => e.entities?.source_id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
  ),
);
```

- [ ] **Step 3: Verify edge function TypeScript**

Run:

```bash
npm run build
```

Expected: frontend build passes. Then deploy to a branch or run Supabase function checks using the project workflow.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/twilio-inbound/index.ts supabase/functions/twilio-call-history/index.ts
git commit -m "refactor(functions): resolve phone contacts through entities"
```

---

### Task 9: Final Verification And Production Cutover

**Files:**
- No additional files.

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: lint passes or only reports pre-existing unrelated findings.

- [ ] **Step 3: Verify no orphan child rows**

Run:

```sql
with child_rows as (
  select 'entity_emails'::text as table_name, id, entity_id from public.entity_emails
  union all
  select 'entity_phones'::text, id, entity_id from public.entity_phones
  union all
  select 'entity_addresses'::text, id, entity_id from public.entity_addresses
  union all
  select 'entity_files'::text, id, entity_id from public.entity_files
  union all
  select 'entity_followers'::text, id, entity_id from public.entity_followers
  union all
  select 'entity_projects'::text, id, entity_id from public.entity_projects
)
select c.table_name, count(*) as orphan_rows
from child_rows c
left join public.entities e on e.id = c.entity_id
where e.id is null
group by c.table_name
order by c.table_name;
```

Expected: zero rows.

- [ ] **Step 4: Verify child type consistency**

Run:

```sql
with child_rows as (
  select 'entity_emails'::text as table_name, id, entity_type::text, entity_id from public.entity_emails
  union all
  select 'entity_phones'::text, id, entity_type::text, entity_id from public.entity_phones
  union all
  select 'entity_addresses'::text, id, entity_type::text, entity_id from public.entity_addresses
  union all
  select 'entity_files'::text, id, entity_type::text, entity_id from public.entity_files
  union all
  select 'entity_followers'::text, id, entity_type::text, entity_id from public.entity_followers
  union all
  select 'entity_projects'::text, id, entity_type::text, entity_id from public.entity_projects
)
select c.table_name, count(*) as mismatched_rows
from child_rows c
join public.entities e on e.id = c.entity_id
where c.entity_type <> e.kind::text
group by c.table_name
order by c.table_name;
```

Expected: zero rows.

- [ ] **Step 5: Manual UI checks**

Open these pages and verify emails, phones, addresses, files, followers, and projects render correctly:

```text
/admin/contacts/people
/admin/contacts/companies
/admin/pipeline
/admin/pipeline/underwriting
/admin/pipeline/lender-management
/admin/pipeline/projects
/admin/lender-programs
```

Expected: existing records still show their child data, new child records can be added, and deleted parent records cascade their shared child data.

- [ ] **Step 6: Production deployment**

After branch verification:

```bash
npm run deploy
```

Expected: migrations and functions deploy successfully.

- [ ] **Step 7: Commit final verification notes**

```bash
git status --short
git commit --allow-empty -m "chore: verify entities parent table migration"
```

---

## Rollback Strategy

Before production cutover, take a Supabase backup or branch snapshot. The migration intentionally quarantines orphaned child rows in `entity_orphans` rather than deleting them without trace.

If rollback is needed before production, reset the Supabase branch to the pre-migration snapshot. If rollback is needed after production, restore the database snapshot; do not hand-edit `entity_id` values because shared child rows now reference canonical `entities.id`.

## Self-Review

- Spec coverage: The plan creates `entities`, backfills people/companies/deals/lender programs, migrates child tables, enforces FKs, preserves orphan data, updates UI callers, updates edge functions, refreshes types/docs, and includes verification.
- Marker scan: No incomplete markers or unspecified implementation steps remain.
- Type consistency: The canonical parent key is `entities.id`; parent tables expose `entity_id`; shared child tables keep `entity_id` but it now references `entities.id`; `entity_type` remains temporarily for compatibility and is synchronized from `entities.kind`.
