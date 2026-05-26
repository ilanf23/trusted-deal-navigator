-- ──────────────────────────────────────────────────────────────────────────
-- NEUTRALIZED 2026-05-26
--
-- This migration originally lifted rows from the legacy `leads` table into
-- the new `people` table AND seeded 15 fake contacts (Marcus Reilly, Diana
-- Zhao, Trevor Washington, …) with (XXX) 555-XXXX phone numbers for demo.
--
-- The demo seed turned out to be the entire CRM — 464 contacts all with 555
-- phone numbers, blocking any real-call caller-name resolution. All demo
-- data was purged in migration `purge_demo_seed_data` and this file was
-- neutralized so a fresh `npm run db:push` against an empty database does
-- not re-seed it.
--
-- The file is intentionally kept (not deleted) so the migration history
-- chain is preserved — Supabase tracks every applied migration by name and
-- removing a name would break `supabase db pull` and break new branches.
-- ──────────────────────────────────────────────────────────────────────────

select 1;
