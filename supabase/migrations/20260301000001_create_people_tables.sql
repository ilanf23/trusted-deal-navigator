-- ══════════════════════════════════════════════════
-- People (Contacts CRM) tables
-- ══════════════════════════════════════════════════

-- Main people table
create table if not exists public.people (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  title text,
  company_name text,
  email text,
  phone text,
  contact_type text default 'Prospect',
  tags text[],
  assigned_to uuid references public.team_members(id),
  notes text,
  linkedin text,
  source text,
  last_activity_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- People tasks table
create table if not exists public.people_tasks (
  id uuid default gen_random_uuid() primary key,
  person_id uuid references public.people(id) on delete cascade not null,
  title text not null,
  status text default 'pending',
  due_date date,
  assigned_to uuid references public.team_members(id),
  created_at timestamptz default now() not null
);

-- People activities table
create table if not exists public.people_activities (
  id uuid default gen_random_uuid() primary key,
  person_id uuid references public.people(id) on delete cascade not null,
  activity_type text not null,
  title text,
  content text,
  created_at timestamptz default now() not null
);

-- Indexes
create index if not exists idx_people_contact_type on public.people(contact_type);
create index if not exists idx_people_assigned_to on public.people(assigned_to);
create index if not exists idx_people_tasks_person_id on public.people_tasks(person_id);
create index if not exists idx_people_activities_person_id on public.people_activities(person_id);

-- RLS
alter table public.people enable row level security;
alter table public.people_tasks enable row level security;
alter table public.people_activities enable row level security;

create policy "Authenticated users can read people"
  on public.people for select to authenticated using (true);

create policy "Authenticated users can insert people"
  on public.people for insert to authenticated with check (true);

create policy "Authenticated users can update people"
  on public.people for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete people"
  on public.people for delete to authenticated using (true);

create policy "Authenticated users can read people_tasks"
  on public.people_tasks for select to authenticated using (true);

create policy "Authenticated users can insert people_tasks"
  on public.people_tasks for insert to authenticated with check (true);

create policy "Authenticated users can update people_tasks"
  on public.people_tasks for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete people_tasks"
  on public.people_tasks for delete to authenticated using (true);

create policy "Authenticated users can read people_activities"
  on public.people_activities for select to authenticated using (true);

create policy "Authenticated users can insert people_activities"
  on public.people_activities for insert to authenticated with check (true);

create policy "Authenticated users can update people_activities"
  on public.people_activities for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete people_activities"
  on public.people_activities for delete to authenticated using (true);
