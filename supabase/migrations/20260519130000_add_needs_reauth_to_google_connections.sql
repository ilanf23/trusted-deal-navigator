-- Add needs_reauth flag. Backfilled rows have tokens that may lack
-- the full combined scopes; they need a fresh unified OAuth consent.

ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS needs_reauth BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing rows as needing re-auth.
-- Only rows created via the new unified flow (exchangeCode action)
-- should have needs_reauth = false; those rows set it explicitly.
UPDATE public.google_connections SET needs_reauth = true;
