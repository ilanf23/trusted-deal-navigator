-- Add a `solution` column to bug_reports so each bug can record what fix was
-- applied. The date a bug was resolved is already captured by the existing
-- `resolved_at` timestamp, so no separate date column is needed: a resolved bug
-- carries both `solution` (what we did) and `resolved_at` (when).
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS solution text;

COMMENT ON COLUMN public.bug_reports.solution IS
  'Free-text description of the fix applied. Paired with resolved_at (when) and status=resolved.';
