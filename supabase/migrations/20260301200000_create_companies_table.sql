-- ══════════════════════════════════════════════════
-- Companies table
-- ══════════════════════════════════════════════════

create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  contact text,
  tasks integer default 0,
  website text,
  contact_type text default 'Prospect',
  email_domain text,
  last_contacted_at timestamptz,
  interactions integer default 0,
  inactive_days integer default 0,
  tags text[],
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes
create index if not exists idx_companies_contact_type on public.companies(contact_type);
create index if not exists idx_companies_name on public.companies(name);

-- RLS
alter table public.companies enable row level security;

create policy "Authenticated users can read companies"
  on public.companies for select to authenticated using (true);

create policy "Authenticated users can insert companies"
  on public.companies for insert to authenticated with check (true);

create policy "Authenticated users can update companies"
  on public.companies for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete companies"
  on public.companies for delete to authenticated using (true);
