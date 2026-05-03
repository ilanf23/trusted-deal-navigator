-- The frontend RateWatch page embeds the lead via `pipeline (...)`:
--   supabase.from('rate_watch').select('*, pipeline (...)')
-- PostgREST resolves embed aliases by matching either the referenced
-- table name OR the foreign-key CONSTRAINT name. `rate_watch` currently
-- has no foreign keys at all, so the embed fails and the page renders
-- "0 borrowers" even though rows exist.
--
-- Add the missing FK and explicitly name it `pipeline` so PostgREST
-- exposes `rate_watch -> potential` under the existing alias without
-- requiring frontend changes.

ALTER TABLE public.rate_watch
  ADD CONSTRAINT pipeline
  FOREIGN KEY (lead_id)
  REFERENCES public.potential(id)
  ON DELETE CASCADE;

-- Tell PostgREST to reload its schema cache so the new relationship
-- is picked up immediately.
NOTIFY pgrst, 'reload schema';
