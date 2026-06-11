-- Merge related_emails + related_phones into related_contact_points (they are
-- shape-identical: value + label + is_primary), and drop the unused
-- related_orphans quarantine table (0 code references, migration debris).
begin;

create table public.related_contact_points (
  id uuid primary key default gen_random_uuid(),
  related_id uuid not null references public.related(id) on delete cascade,
  related_type public.related_type_enum,
  kind text not null check (kind in ('email', 'phone')),
  value text not null,
  label text,
  is_primary boolean,
  created_at timestamptz not null default now()
);

create index related_contact_points_related_id_idx
  on public.related_contact_points (related_id);
create index related_contact_points_kind_related_idx
  on public.related_contact_points (kind, related_id);

alter table public.related_contact_points enable row level security;

create policy "Admins and super admins can manage related contact points"
on public.related_contact_points
for all
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
);

create trigger trg_related_contact_points_sync_type
before insert or update of related_id, related_type on public.related_contact_points
for each row execute function public.sync_child_related_type();

-- Copy preserving ids and timestamps. The sync trigger re-derives related_type
-- on insert, which matches the source values by construction.
insert into public.related_contact_points
  (id, related_id, related_type, kind, value, label, is_primary, created_at)
select id, related_id, related_type, 'email', email, email_type, is_primary, created_at
from public.related_emails;

insert into public.related_contact_points
  (id, related_id, related_type, kind, value, label, is_primary, created_at)
select id, related_id, related_type, 'phone', phone_number, phone_type, is_primary, created_at
from public.related_phones;

do $$
declare
  copied int;
  expected int;
begin
  select count(*) into copied from public.related_contact_points;
  select (select count(*) from public.related_emails)
       + (select count(*) from public.related_phones) into expected;
  if copied <> expected then
    raise exception 'contact point copy mismatch: copied %, expected %', copied, expected;
  end if;
end $$;

drop table public.related_emails;
drop table public.related_phones;
drop table public.related_orphans;

commit;
