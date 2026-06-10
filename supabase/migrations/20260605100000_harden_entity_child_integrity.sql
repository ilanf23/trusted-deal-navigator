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

create or replace function public.delete_parent_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.entities where id = old.entity_id;
  return old;
end;
$$;

drop trigger if exists trg_people_delete_entity on public.people;
create trigger trg_people_delete_entity
after delete on public.people
for each row execute function public.delete_parent_entity();

drop trigger if exists trg_companies_delete_entity on public.companies;
create trigger trg_companies_delete_entity
after delete on public.companies
for each row execute function public.delete_parent_entity();

drop trigger if exists trg_deals_delete_entity on public.deals;
create trigger trg_deals_delete_entity
after delete on public.deals
for each row execute function public.delete_parent_entity();

drop trigger if exists trg_lender_programs_delete_entity on public.lender_programs;
create trigger trg_lender_programs_delete_entity
after delete on public.lender_programs
for each row execute function public.delete_parent_entity();

commit;
