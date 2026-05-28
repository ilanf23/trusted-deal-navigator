-- Remove the standalone Notes feature entirely.
-- The `notes` table was a test feature built during platform development and is
-- no longer needed. It had zero rows and is distinct from the activity-based
-- note-taking used in the ExpandedViews (which lives in `activities`).
-- Dropping the table also removes its RLS policies and triggers automatically.
-- The shared `entity_type_enum` is intentionally left in place because other
-- tables (activities, etc.) still depend on it.

DROP TABLE IF EXISTS public.notes CASCADE;
