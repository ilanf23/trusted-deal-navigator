-- 20260604145025_remote_applied_directly.sql
--
-- HISTORY-ALIGNMENT PLACEHOLDER (no-op).
--
-- This migration version is recorded as APPLIED in the remote database's
-- supabase_migrations.schema_migrations table but its SQL exists in no git
-- branch — it was applied directly to the remote DB (e.g. via the Supabase
-- dashboard or an ad-hoc push) on 2026-06-04.
--
-- This file exists only so the local migrations directory is a complete
-- superset of the remote migration history; `supabase db push` skips it
-- because the version is already applied remotely (it is never re-executed).
-- Do NOT add statements here — the real changes already live in the DB.

select 1;
