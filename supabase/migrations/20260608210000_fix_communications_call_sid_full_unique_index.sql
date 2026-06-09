-- Root-cause fix for "calls stopped getting transcribed after May 26".
--
-- Every Twilio edge function inserts via PostgREST upsert with
-- onConflict: 'call_sid', i.e. INSERT ... ON CONFLICT (call_sid) DO NOTHING.
-- The prior unique index was PARTIAL (WHERE call_sid IS NOT NULL). Postgres
-- refuses to use a partial index as an ON CONFLICT arbiter unless the same
-- predicate is restated, which PostgREST does not do -- so every insert failed
-- with 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
-- specification") and no communications row was ever created (no recording,
-- no transcript, no Transcript button). This lined up exactly with the May-26
-- refactor that switched the call pipeline to the upsert pattern.
--
-- Replace it with a full (non-partial) unique index on call_sid. NULLs remain
-- allowed multiple times (btree treats NULL as distinct), so non-call rows
-- (emails, etc.) with call_sid IS NULL are unaffected. Non-null call_sids were
-- already unique under the partial index, so this CREATE cannot fail on dupes.
drop index if exists public.communications_call_sid_unique;
create unique index communications_call_sid_unique
  on public.communications (call_sid);
