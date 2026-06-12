-- Convert user-identity columns stored as free text (names, email prefixes,
-- stringified uuids) into proper uuid foreign keys referencing users(id).
--
-- Issue: related_files.uploaded_by (formerly entity_files) held a mix of
-- uuid strings and display names ("sergey"). The same pattern existed on
-- 7 more text columns, and 4 tables carried a legacy denormalized name
-- column alongside an existing user_id uuid column.
--
-- Backfill resolves each text value against users by, in priority order:
-- stringified id, full email, email prefix, display name (all case-insensitive).
-- Unresolvable values become NULL — every affected column is nullable.

BEGIN;

CREATE FUNCTION pg_temp.resolve_user(ref text)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT u.id
  FROM public.users u
  WHERE ref IS NOT NULL AND btrim(ref) <> '' AND (
    u.id::text = lower(btrim(ref))
    OR lower(u.email) = lower(btrim(ref))
    OR split_part(lower(u.email), '@', 1) = lower(btrim(ref))
    OR lower(u.name) = lower(btrim(ref))
  )
  ORDER BY
    (u.id::text = lower(btrim(ref))) DESC,
    (lower(u.email) = lower(btrim(ref))) DESC,
    (split_part(lower(u.email), '@', 1) = lower(btrim(ref))) DESC
  LIMIT 1;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- A. Text identity columns → uuid FK (same column name, new type)
-- ───────────────────────────────────────────────────────────────────────────

-- related_files.uploaded_by (the reported issue)
ALTER TABLE public.related_files ADD COLUMN uploaded_by_uuid uuid;
UPDATE public.related_files SET uploaded_by_uuid = pg_temp.resolve_user(uploaded_by);
ALTER TABLE public.related_files DROP COLUMN uploaded_by;
ALTER TABLE public.related_files RENAME COLUMN uploaded_by_uuid TO uploaded_by;
ALTER TABLE public.related_files
  ADD CONSTRAINT related_files_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX idx_related_files_uploaded_by ON public.related_files(uploaded_by);

-- activities.created_by
ALTER TABLE public.activities ADD COLUMN created_by_uuid uuid;
UPDATE public.activities SET created_by_uuid = pg_temp.resolve_user(created_by);
ALTER TABLE public.activities DROP COLUMN created_by;
ALTER TABLE public.activities RENAME COLUMN created_by_uuid TO created_by;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX idx_activities_created_by ON public.activities(created_by);

-- activity_comments.created_by
ALTER TABLE public.activity_comments ADD COLUMN created_by_uuid uuid;
UPDATE public.activity_comments SET created_by_uuid = pg_temp.resolve_user(created_by);
ALTER TABLE public.activity_comments DROP COLUMN created_by;
ALTER TABLE public.activity_comments RENAME COLUMN created_by_uuid TO created_by;
ALTER TABLE public.activity_comments
  ADD CONSTRAINT activity_comments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- tasks.created_by
ALTER TABLE public.tasks ADD COLUMN created_by_uuid uuid;
UPDATE public.tasks SET created_by_uuid = pg_temp.resolve_user(created_by);
ALTER TABLE public.tasks DROP COLUMN created_by;
ALTER TABLE public.tasks RENAME COLUMN created_by_uuid TO created_by;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- bug_reports.submitted_by (submitted_by_email stays as informational text)
ALTER TABLE public.bug_reports ADD COLUMN submitted_by_uuid uuid;
UPDATE public.bug_reports
  SET submitted_by_uuid = COALESCE(
    pg_temp.resolve_user(submitted_by),
    pg_temp.resolve_user(submitted_by_email)
  );
ALTER TABLE public.bug_reports DROP COLUMN submitted_by;
ALTER TABLE public.bug_reports RENAME COLUMN submitted_by_uuid TO submitted_by;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- deal_milestones.completed_by (no current writers; ready for use)
ALTER TABLE public.deal_milestones ADD COLUMN completed_by_uuid uuid;
UPDATE public.deal_milestones SET completed_by_uuid = pg_temp.resolve_user(completed_by);
ALTER TABLE public.deal_milestones DROP COLUMN completed_by;
ALTER TABLE public.deal_milestones RENAME COLUMN completed_by_uuid TO completed_by;
ALTER TABLE public.deal_milestones
  ADD CONSTRAINT deal_milestones_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- deal_waiting_on.resolved_by (owner stays text — it is a free-text party
-- label like "Borrower"/"Lender", not a team member reference)
ALTER TABLE public.deal_waiting_on ADD COLUMN resolved_by_uuid uuid;
UPDATE public.deal_waiting_on SET resolved_by_uuid = pg_temp.resolve_user(resolved_by);
ALTER TABLE public.deal_waiting_on DROP COLUMN resolved_by;
ALTER TABLE public.deal_waiting_on RENAME COLUMN resolved_by_uuid TO resolved_by;
ALTER TABLE public.deal_waiting_on
  ADD CONSTRAINT deal_waiting_on_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- related_projects.created_by
ALTER TABLE public.related_projects ADD COLUMN created_by_uuid uuid;
UPDATE public.related_projects SET created_by_uuid = pg_temp.resolve_user(created_by);
ALTER TABLE public.related_projects DROP COLUMN created_by;
ALTER TABLE public.related_projects RENAME COLUMN created_by_uuid TO created_by;
ALTER TABLE public.related_projects
  ADD CONSTRAINT related_projects_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- B. Drop legacy denormalized name columns where a user_id uuid already exists
-- ───────────────────────────────────────────────────────────────────────────

-- task_activities: backfill user_id from created_by, then drop the text column.
-- 'System' rows resolve to NULL user_id — the UI renders NULL as "System".
UPDATE public.task_activities
  SET user_id = pg_temp.resolve_user(created_by)
  WHERE user_id IS NULL;
ALTER TABLE public.task_activities DROP COLUMN created_by;

-- appointments: backfill user_id from user_name, then drop the text column.
UPDATE public.appointments
  SET user_id = pg_temp.resolve_user(user_name)
  WHERE user_id IS NULL;
ALTER TABLE public.appointments DROP COLUMN user_name;

-- feed_reactions: user_id is already NOT NULL; the name copy is redundant.
ALTER TABLE public.feed_reactions DROP COLUMN user_name;

-- dropbox_connections: connected_by duplicated the connecting user's name.
ALTER TABLE public.dropbox_connections DROP COLUMN connected_by;

-- ───────────────────────────────────────────────────────────────────────────
-- C. Add missing FKs on existing uuid user columns
-- ───────────────────────────────────────────────────────────────────────────

-- Remove orphans first (pre-production data; referential integrity wins).
DELETE FROM public.feed_reactions fr
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = fr.user_id);
ALTER TABLE public.feed_reactions
  DROP CONSTRAINT IF EXISTS feed_reactions_user_id_fkey;
ALTER TABLE public.feed_reactions
  ADD CONSTRAINT feed_reactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- dropbox_connections.user_id had an FK to auth.users under the same default
-- name; repoint it at public.users (users.id mirrors the auth uid, and app
-- flows delete the public.users row).
DELETE FROM public.dropbox_connections dc
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = dc.user_id);
ALTER TABLE public.dropbox_connections
  DROP CONSTRAINT IF EXISTS dropbox_connections_user_id_fkey;
ALTER TABLE public.dropbox_connections
  ADD CONSTRAINT dropbox_connections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DELETE FROM public.google_connections gc
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = gc.user_id);
ALTER TABLE public.google_connections
  DROP CONSTRAINT IF EXISTS google_connections_user_id_fkey;
ALTER TABLE public.google_connections
  ADD CONSTRAINT google_connections_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- volume_log_sync_config.created_by also had an auth.users FK under the same
-- default name; repoint it at public.users.
UPDATE public.volume_log_sync_config vc
  SET created_by = NULL
  WHERE created_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = vc.created_by);
ALTER TABLE public.volume_log_sync_config
  DROP CONSTRAINT IF EXISTS volume_log_sync_config_created_by_fkey;
ALTER TABLE public.volume_log_sync_config
  ADD CONSTRAINT volume_log_sync_config_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- D. Update the bug-report notification trigger: submitted_by is now a uuid
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_super_admins_of_bug_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reporter_name text;
BEGIN
  BEGIN
    SELECT name INTO reporter_name FROM public.users WHERE id = NEW.submitted_by;

    INSERT INTO public.notifications (user_id, type, title, description, link_url)
    SELECT
      u.id,
      'system',
      'New bug report: ' || NEW.title,
      COALESCE(NULLIF(NEW.description, ''), 'Reported by ' || COALESCE(reporter_name, 'a team member')),
      '/superadmin/ilan/bugs'
    FROM public.users u
    WHERE u.app_role = 'super_admin'::app_role
      AND u.is_active = true;
  EXCEPTION WHEN OTHERS THEN
    -- Never block the bug report from saving on a notification failure.
    RAISE WARNING 'notify_super_admins_of_bug_report failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMIT;
