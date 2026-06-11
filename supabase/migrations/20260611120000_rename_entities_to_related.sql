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
      replace(replace(replace(r.policyname,
        'entities', 'related'), 'entity', 'related'), 'Entit', 'Relat')
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
