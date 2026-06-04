-- Remove the team_monthly_goals feature entirely.
-- This table was meant to back per-team-member goal progress bars on the
-- individual dashboards, but no write path was ever built (no insert/update in
-- the app, no edge function, no admin UI), so it sat empty in every environment.
-- The goal-display sections of the dashboards and their hook queries have been
-- removed alongside this migration.
-- Dropping the table also removes its RLS policies and the updated_at trigger.

DROP TABLE IF EXISTS public.team_monthly_goals CASCADE;
