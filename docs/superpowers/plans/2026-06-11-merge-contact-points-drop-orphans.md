# Merge related_emails + related_phones → related_contact_points; drop related_orphans

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the two shape-identical contact child tables into one `related_contact_points` table and drop the unused `related_orphans` quarantine table. 8 related tables → 6.

**Architecture:** One migration creates the new table (with the existing `sync_child_related_type()` trigger attached), copies all rows preserving ids/timestamps with a count assertion, and drops the three old tables. ~14 code files convert `.from('related_emails'/'related_phones')` to `.from('related_contact_points')` + `kind` filter, with column maps `email|phone_number → value`, `email_type|phone_type → label`. `types.ts` is hand-updated (gen-types is blocked: no SUPABASE_ACCESS_TOKEN).

**Approved design (user, 2026-06-11):** columns `kind/value/label`; addresses/files/followers/projects stay separate; orphans dropped (525 rows of migration quarantine debris, 0 code references, pre-prod fake data).

**Verified facts:** 554 email rows + 554 phone rows = 1,108 to copy. No realtime subscriptions on any affected table. No FKs reference the dropped tables.

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260611150000_merge_contact_points_drop_orphans.sql`

```sql
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
```

- [ ] Step 1: Create the file with the SQL above; commit.

### Task 2: Code conversion (~14 files)

Transformation rules:
- `.from('related_emails')` → `.from('related_contact_points')` + `.eq('kind', 'email')` on selects/updates/deletes; inserts add `kind: 'email'`
- `.from('related_phones')` → same with `kind: 'phone'`
- Column maps: `email` → `value`, `phone_number` → `value`, `email_type` → `label`, `phone_type` → `label`
- Gmail nested embed (`useGmailLogic.ts:198`): `related!people_related_id_fkey(related_emails(email, email_type))` → `related!people_related_id_fkey(related_contact_points(kind, value, label))`, filter `kind === 'email'` in the mapping code
- `twilio-inbound` / `twilio-call-history` phone lookups: `.from('related_contact_points').eq('kind','phone').ilike('value', …)`
- Local variable/property names referencing the shapes updated to compile

Files: LeadDetailDialog, LenderManagementExpandedView, PeopleDetailPanel, PeopleExpandedView, PipelineDetailPanel, PipelineExpandedView, ProjectDetailPanel, UnderwritingDetailPanel, UnderwritingExpandedView, useAllPipelineLeads, useGmailLogic, usePipelineMutations, People.tsx, twilio-call-history, twilio-inbound.

- [ ] Step 1: Convert hooks + edge functions
- [ ] Step 2: Convert components/pages
- [ ] Step 3: Hand-update `types.ts`: add `related_contact_points` table type, remove `related_emails`/`related_phones`/`related_orphans`
- [ ] Step 4: Sweep: `grep -rn "related_emails\|related_phones\|related_orphans" src supabase/functions` (excluding migrations) → zero
- [ ] Step 5: `npx tsc --noEmit` + `npm run build` clean; commit

### Task 3: Push + deploy + verify

- [ ] Step 1: `npm run db:push` (if direct DB connectivity still down and CLI also fails, stop and wait for the network)
- [ ] Step 2: REST verify: new table count = 1,108; `kind` split = 554/554; old table names 404; Gmail embed shape parses
- [ ] Step 3: `npm run functions:deploy`
- [ ] Step 4: UI smoke: person detail panel (emails/phones sections read+add), Calls page loads
- [ ] Step 5: Update `schema.md` (mechanical or regen if connectivity is back); commit
