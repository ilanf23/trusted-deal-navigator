begin;

create or replace function public.create_parent_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public.entity_kind;
  v_name text;
  v_row jsonb;
begin
  if new.entity_id is not null then
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
      raise exception 'create_parent_entity attached to unexpected table %', tg_table_name;
  end case;

  insert into public.entities (kind, source_id, display_name)
  values (v_kind, new.id, v_name)
  on conflict (kind, source_id) do update set display_name = excluded.display_name
  returning id into new.entity_id;

  return new;
end;
$$;

drop trigger if exists trg_people_create_entity on public.people;
create trigger trg_people_create_entity
before insert on public.people
for each row execute function public.create_parent_entity();

drop trigger if exists trg_companies_create_entity on public.companies;
create trigger trg_companies_create_entity
before insert on public.companies
for each row execute function public.create_parent_entity();

drop trigger if exists trg_deals_create_entity on public.deals;
create trigger trg_deals_create_entity
before insert on public.deals
for each row execute function public.create_parent_entity();

drop trigger if exists trg_lender_programs_create_entity on public.lender_programs;
create trigger trg_lender_programs_create_entity
before insert on public.lender_programs
for each row execute function public.create_parent_entity();

commit;
