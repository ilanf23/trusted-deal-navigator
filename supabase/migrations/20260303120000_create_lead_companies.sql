-- Junction table: associate multiple companies with a lead
create table if not exists lead_companies (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  company_name text not null,
  created_at timestamptz default now()
);

-- Index for fast lookup by lead
create index if not exists idx_lead_companies_lead_id on lead_companies(lead_id);

-- RLS
alter table lead_companies enable row level security;
create policy "Authenticated users can manage lead_companies"
  on lead_companies for all
  using (true)
  with check (true);
