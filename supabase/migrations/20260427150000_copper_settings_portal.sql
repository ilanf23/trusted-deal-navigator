-- Copper-style universal settings portal: schema additions
-- Workspace-level + per-user customization tables, plus per-user preference columns.

-- Workspace-level settings (single row for now; future-proofed for multi-workspace)
create table if not exists workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_name text not null default 'Commercial Lending X',
  logo_url text,
  primary_color text default '#3b2778',
  secondary_color text default '#eee6f6',
  accent_color text default '#ec4899',
  default_theme text default 'system',
  invite_admins_only boolean default false,
  default_invite_role text default 'admin',
  default_google_sync boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Custom field sections (groupings of custom fields per entity type)
create table if not exists custom_field_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace_settings(id) on delete cascade,
  entity_type text not null,
  name text not null,
  position integer not null default 0,
  created_at timestamptz default now()
);
create index if not exists custom_field_sections_entity_idx on custom_field_sections(entity_type);

-- Custom fields
create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace_settings(id) on delete cascade,
  entity_type text not null,
  section_id uuid references custom_field_sections(id) on delete set null,
  field_key text not null,
  label text not null,
  field_type text not null,
  options jsonb,
  required boolean default false,
  default_value text,
  position integer not null default 0,
  visibility jsonb,
  created_at timestamptz default now()
);
create unique index if not exists custom_fields_entity_key_idx on custom_fields(entity_type, field_key);
create index if not exists custom_fields_entity_idx on custom_fields(entity_type);

-- Per-record custom field values
create table if not exists custom_field_values (
  id uuid primary key default gen_random_uuid(),
  custom_field_id uuid not null references custom_fields(id) on delete cascade,
  record_id uuid not null,
  record_type text not null,
  value jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists cfv_record_idx on custom_field_values(record_type, record_id);
create index if not exists cfv_field_idx on custom_field_values(custom_field_id);

-- Per-pipeline record layouts (which fields show on the expanded view)
create table if not exists record_layouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace_settings(id) on delete cascade,
  entity_type text not null,
  pipeline_name text,
  field_keys jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists record_layouts_entity_idx on record_layouts(entity_type, pipeline_name);

-- Custom activity types (extend the existing system enum with admin-defined ones)
create table if not exists activity_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace_settings(id) on delete cascade,
  name text not null,
  icon text not null,
  color text not null,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- Per-role nav config (drives the AdminSidebar items)
create table if not exists nav_config (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace_settings(id) on delete cascade,
  role text not null,
  items jsonb not null,
  updated_at timestamptz default now()
);
create unique index if not exists nav_config_role_idx on nav_config(role);

-- Email templates (personal + shared)
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace_settings(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  variables jsonb,
  is_shared boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists email_templates_user_idx on email_templates(user_id);
create index if not exists email_templates_shared_idx on email_templates(is_shared) where is_shared = true;

-- Webhooks (custom integration)
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace_settings(id) on delete cascade,
  name text not null,
  url text not null,
  secret text not null,
  events jsonb not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- User preference columns
alter table users add column if not exists preferences jsonb default '{}'::jsonb;
alter table users add column if not exists notification_preferences jsonb default '{}'::jsonb;
alter table users add column if not exists email_signature text;
alter table users add column if not exists timezone text default 'America/Chicago';
alter table users add column if not exists date_format text default 'MM/DD/YYYY';
alter table users add column if not exists time_format text default '12';
alter table users add column if not exists currency text default 'USD';
alter table users add column if not exists language text default 'en';

-- Seed the default workspace
insert into workspace_settings (workspace_name)
select 'Commercial Lending X'
where not exists (select 1 from workspace_settings);

-- RLS
alter table workspace_settings enable row level security;
alter table custom_fields enable row level security;
alter table custom_field_sections enable row level security;
alter table custom_field_values enable row level security;
alter table record_layouts enable row level security;
alter table activity_types enable row level security;
alter table nav_config enable row level security;
alter table email_templates enable row level security;
alter table webhooks enable row level security;

-- Authenticated users may read workspace-level config
create policy "workspace_settings_select" on workspace_settings for select using (auth.role() = 'authenticated');
create policy "custom_fields_select" on custom_fields for select using (auth.role() = 'authenticated');
create policy "custom_field_sections_select" on custom_field_sections for select using (auth.role() = 'authenticated');
create policy "custom_field_values_select" on custom_field_values for select using (auth.role() = 'authenticated');
create policy "record_layouts_select" on record_layouts for select using (auth.role() = 'authenticated');
create policy "activity_types_select" on activity_types for select using (auth.role() = 'authenticated');
create policy "nav_config_select" on nav_config for select using (auth.role() = 'authenticated');
create policy "webhooks_select" on webhooks for select using (auth.role() = 'authenticated');

-- Only owners/admins may write workspace-level config
create policy "workspace_settings_write" on workspace_settings for all
  using (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))))
  with check (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))));
create policy "custom_fields_write" on custom_fields for all
  using (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))))
  with check (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))));
create policy "custom_field_sections_write" on custom_field_sections for all
  using (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))))
  with check (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))));
create policy "record_layouts_write" on record_layouts for all
  using (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))))
  with check (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))));
create policy "activity_types_write" on activity_types for all
  using (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))))
  with check (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))));
create policy "nav_config_write" on nav_config for all
  using (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))))
  with check (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))));
create policy "webhooks_write" on webhooks for all
  using (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))))
  with check (exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin'))));

-- Custom field values: any authenticated user can read/write (the underlying record's RLS gates access in practice)
create policy "custom_field_values_write" on custom_field_values for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Email templates: own templates writable by self; shared readable by all, writable by owners/admins
create policy "email_templates_select_own_or_shared" on email_templates for select
  using (auth.role() = 'authenticated' and (user_id = auth.uid() or is_shared = true));
create policy "email_templates_insert_self" on email_templates for insert
  with check (
    user_id = auth.uid()
    and (
      is_shared = false
      or exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin')))
    )
  );
create policy "email_templates_update_own_or_admin" on email_templates for update
  using (
    user_id = auth.uid()
    or exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin')))
  );
create policy "email_templates_delete_own_or_admin" on email_templates for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from users where users.id = auth.uid() and (users.is_owner = true or users.app_role in ('admin','super_admin')))
  );
