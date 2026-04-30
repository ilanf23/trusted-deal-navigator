-- task_saved_filters: persisted saved filters for the Tasks page.
-- Supports public (visible to everyone) and private (visible to creator only)
-- filters. Owners and admins/super_admins can manage public filters.

create table if not exists public.task_saved_filters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  criteria jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists task_saved_filters_created_by_idx
  on public.task_saved_filters(created_by);
create index if not exists task_saved_filters_visibility_idx
  on public.task_saved_filters(visibility);

alter table public.task_saved_filters enable row level security;

-- Read: anyone authenticated can see public filters; users can see their own private ones.
-- Seeded system filters (created_by IS NULL) are treated as public-by-everyone.
drop policy if exists "Read task saved filters" on public.task_saved_filters;
create policy "Read task saved filters"
  on public.task_saved_filters for select
  to authenticated
  using (
    visibility = 'public'
    or created_by = (select id from public.users where user_id = auth.uid())
  );

-- Insert: caller must be the row's owner.
drop policy if exists "Create task saved filters" on public.task_saved_filters;
create policy "Create task saved filters"
  on public.task_saved_filters for insert
  to authenticated
  with check (
    created_by = (select id from public.users where user_id = auth.uid())
  );

-- Update: owner OR team owner OR admin/super_admin.
drop policy if exists "Update task saved filters" on public.task_saved_filters;
create policy "Update task saved filters"
  on public.task_saved_filters for update
  to authenticated
  using (
    created_by = (select id from public.users where user_id = auth.uid())
    or public.is_team_owner()
    or exists (
      select 1 from public.users u
      where u.user_id = auth.uid()
        and u.app_role in ('admin', 'super_admin')
    )
  );

-- Delete: same as update.
drop policy if exists "Delete task saved filters" on public.task_saved_filters;
create policy "Delete task saved filters"
  on public.task_saved_filters for delete
  to authenticated
  using (
    created_by = (select id from public.users where user_id = auth.uid())
    or public.is_team_owner()
    or exists (
      select 1 from public.users u
      where u.user_id = auth.uid()
        and u.app_role in ('admin', 'super_admin')
    )
  );

-- updated_at maintenance via the existing project trigger function.
drop trigger if exists task_saved_filters_set_updated_at on public.task_saved_filters;
create trigger task_saved_filters_set_updated_at
  before update on public.task_saved_filters
  for each row execute function public.update_updated_at_column();

-- Seed baseline public filters (created_by IS NULL → system-owned, visible to all,
-- only manageable by team owners / admins via the policies above).
insert into public.task_saved_filters (name, description, visibility, criteria, created_by, position)
values
  ('All Tasks',
   'Every task in the workspace.',
   'public',
   '{"includeCompleted": true}'::jsonb,
   null, 0),
  ('My Open Tasks',
   'Tasks assigned to you that are not yet complete.',
   'public',
   '{"assignedToMe": true, "includeCompleted": false}'::jsonb,
   null, 1),
  ('Due Today',
   'Tasks with a due date of today.',
   'public',
   '{"dueDateRange": {"preset": "today"}, "includeCompleted": false}'::jsonb,
   null, 2),
  ('Overdue',
   'Tasks with a due date in the past that are still open.',
   'public',
   '{"dueDateRange": {"preset": "overdue"}, "includeCompleted": false}'::jsonb,
   null, 3),
  ('Completed',
   'Tasks that have been marked complete.',
   'public',
   '{"status": ["done"], "includeCompleted": true}'::jsonb,
   null, 4)
on conflict do nothing;

-- Add the per-user default filter pointer alongside other preferences. Stored in the
-- existing users.preferences JSONB column under key "default_task_filter_id".
-- No DDL change needed — the JSON shape is owned by application code (useUserPreferences).
