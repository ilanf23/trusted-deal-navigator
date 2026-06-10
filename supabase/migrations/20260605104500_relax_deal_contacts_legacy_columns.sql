begin;

-- deal_contacts.entity_id is a legacy column from the entity_contacts era; deal_id
-- is the canonical reference now. Keep the column for rollback visibility but stop
-- requiring writers to populate it.
alter table public.deal_contacts alter column entity_id drop not null;

commit;
