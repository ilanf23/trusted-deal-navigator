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
select 'lender_programs'::public.entity_kind, lp.id, coalesce(lp.program_name, lp.lender_name), lp.created_at, lp.updated_at
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
