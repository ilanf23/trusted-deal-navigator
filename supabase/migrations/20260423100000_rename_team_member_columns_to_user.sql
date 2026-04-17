-- Rename legacy `team_member_id` / `team_member_name` columns to `user_id` / `user_name`.
-- Context: after the `team_members` -> `users` table consolidation, these FK columns
-- kept their legacy names. This migration renames them, plus the associated FK
-- constraints and indexes, to reflect the current schema vocabulary.
--
-- NOT renamed:
--   - ai_agent_changes.team_member_id (collides with an existing unconstrained `user_id` column;
--     handled in a separate follow-up migration).
--
-- RLS policies and the `v_team_performance` view are stored as bound parse trees,
-- so they follow column renames automatically and need no DDL changes here.

BEGIN;

----------------------------------------------------------------------
-- A. Rename `team_member_id` -> `user_id` on 11 tables
----------------------------------------------------------------------

ALTER TABLE public.active_calls        RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.appointments        RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.communications      RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.dashboard_deals     RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.email_templates     RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.entity_followers    RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.notes               RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.notifications       RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.task_activities     RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.tasks               RENAME COLUMN team_member_id TO user_id;
ALTER TABLE public.team_monthly_goals  RENAME COLUMN team_member_id TO user_id;

----------------------------------------------------------------------
-- B. Rename `team_member_name` -> `user_name` on 3 denormalized tables
----------------------------------------------------------------------

ALTER TABLE public.appointments          RENAME COLUMN team_member_name TO user_name;
ALTER TABLE public.calendar_connections  RENAME COLUMN team_member_name TO user_name;
ALTER TABLE public.sheets_connections    RENAME COLUMN team_member_name TO user_name;

----------------------------------------------------------------------
-- C. Rename FK constraints from *_team_member_id_fkey -> *_user_id_fkey
----------------------------------------------------------------------

ALTER TABLE public.active_calls        RENAME CONSTRAINT active_calls_team_member_id_fkey        TO active_calls_user_id_fkey;
ALTER TABLE public.appointments        RENAME CONSTRAINT appointments_team_member_id_fkey        TO appointments_user_id_fkey;
ALTER TABLE public.communications      RENAME CONSTRAINT communications_team_member_id_fkey      TO communications_user_id_fkey;
ALTER TABLE public.dashboard_deals     RENAME CONSTRAINT dashboard_deals_team_member_id_fkey     TO dashboard_deals_user_id_fkey;
ALTER TABLE public.email_templates     RENAME CONSTRAINT email_templates_team_member_id_fkey     TO email_templates_user_id_fkey;
ALTER TABLE public.entity_followers    RENAME CONSTRAINT lead_followers_team_member_id_fkey      TO entity_followers_user_id_fkey;
ALTER TABLE public.notes               RENAME CONSTRAINT notes_team_member_id_fkey               TO notes_user_id_fkey;
ALTER TABLE public.notifications       RENAME CONSTRAINT notifications_team_member_id_fkey       TO notifications_user_id_fkey;
ALTER TABLE public.task_activities     RENAME CONSTRAINT task_activities_team_member_id_fkey     TO task_activities_user_id_fkey;
ALTER TABLE public.tasks               RENAME CONSTRAINT tasks_team_member_id_fkey               TO tasks_user_id_fkey;
ALTER TABLE public.team_monthly_goals  RENAME CONSTRAINT team_monthly_goals_team_member_id_fkey  TO team_monthly_goals_user_id_fkey;

----------------------------------------------------------------------
-- D. Fix stale FK constraint names on already-correctly-named columns
----------------------------------------------------------------------

ALTER TABLE public.entity_projects RENAME CONSTRAINT lead_projects_owner_fkey   TO entity_projects_owner_fkey;
ALTER TABLE public.potential       RENAME CONSTRAINT pipeline_assigned_to_fkey  TO potential_assigned_to_fkey;

----------------------------------------------------------------------
-- E. Rename indexes that embed the legacy column name
----------------------------------------------------------------------

ALTER INDEX public.idx_active_calls_team_member_id      RENAME TO idx_active_calls_user_id;
ALTER INDEX public.idx_appointments_team_member_id      RENAME TO idx_appointments_user_id;
ALTER INDEX public.idx_communications_team_member_id    RENAME TO idx_communications_user_id;
ALTER INDEX public.idx_notes_team_member_id             RENAME TO idx_notes_user_id;
ALTER INDEX public.idx_tasks_team_member_id             RENAME TO idx_tasks_user_id;
ALTER INDEX public.idx_calendar_connections_team_member RENAME TO idx_calendar_connections_user_name;
ALTER INDEX public.lead_followers_lead_id_team_member_id_key RENAME TO entity_followers_entity_id_user_id_key;

-- idx_notifications_user_read_created already has a neutral name, no rename.

COMMIT;
