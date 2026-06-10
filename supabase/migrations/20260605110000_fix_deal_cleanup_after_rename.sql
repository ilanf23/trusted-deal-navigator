begin;

-- cleanup_deal_polymorphic_children still referenced entity_contacts (renamed to
-- deal_contacts), which made every deal delete fail. The shared entity child
-- tables (entity_emails/phones/addresses/files/projects) are now cleaned up by
-- the entities FK cascade (delete_parent_entity trigger), and deal_contacts is
-- cleaned up by its deal_id FK cascade, so this trigger only needs to cover the
-- tables still using legacy entity_type + entity_id references.
create or replace function public.cleanup_deal_polymorphic_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_type_val public.entity_type_enum;
begin
  entity_type_val := TG_ARGV[0]::public.entity_type_enum;

  delete from public.activities        where entity_id = old.id and entity_type = entity_type_val;
  delete from public.activity_comments where lead_id = old.id;

  return old;
end $$;

-- Zombie RPC: references the dropped entity_contacts table and the long-gone
-- potential/underwriting/lender_management split tables. No app callers remain.
drop function if exists public.move_deal_between_pipelines(uuid, text, text);

commit;
