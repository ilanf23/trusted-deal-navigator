begin;

alter table public.entity_contacts rename to deal_contacts;

alter table public.deal_contacts
  add column if not exists deal_id uuid;

-- entity_id here holds raw deals.id values (this table was never rewritten
-- to canonical entity ids), so the deal id is the entity_id itself.
update public.deal_contacts dc
set deal_id = dc.entity_id
where dc.deal_id is null
  and exists (select 1 from public.deals d where d.id = dc.entity_id);

insert into public.entity_orphans (source_table, source_id, original_entity_type, original_entity_id, payload, reason)
select 'deal_contacts', dc.id, dc.entity_type::text, dc.entity_id, to_jsonb(dc), 'No matching deal before deal_contacts re-model'
from public.deal_contacts dc
where dc.deal_id is null
on conflict do nothing;

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
