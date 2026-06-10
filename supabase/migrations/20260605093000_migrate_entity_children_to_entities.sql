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
