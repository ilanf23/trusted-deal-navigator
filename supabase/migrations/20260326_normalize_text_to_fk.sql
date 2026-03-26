-- Phase 2 & 3: Normalize text name columns to FK references
-- This migration adds FK columns where missing, backfills from text,
-- but does NOT drop old columns yet (frontend uses fallbacks during transition)

-- ============================================================
-- Phase 3b: team_monthly_goals — add team_member_id FK
-- ============================================================
ALTER TABLE public.team_monthly_goals
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES public.team_members(id);

UPDATE public.team_monthly_goals g
SET team_member_id = tm.id
FROM public.team_members tm
WHERE g.team_member_id IS NULL
  AND LOWER(g.team_member_name) = LOWER(tm.name);

-- ============================================================
-- Phase 3c: dashboard_deals — add team_member_id FK
-- ============================================================
ALTER TABLE public.dashboard_deals
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES public.team_members(id);

UPDATE public.dashboard_deals dd
SET team_member_id = tm.id
FROM public.team_members tm
WHERE dd.team_member_id IS NULL
  AND LOWER(dd.owner_name) = LOWER(tm.name);

-- ============================================================
-- Phase 3d: email_templates — add team_member_id FK
-- ============================================================
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES public.team_members(id);

UPDATE public.email_templates et
SET team_member_id = tm.id
FROM public.team_members tm
WHERE et.team_member_id IS NULL
  AND LOWER(et.team_member_name) = LOWER(tm.name);

-- ============================================================
-- Phase 3e: bug_reports — add assigned_to_id FK (text assigned_to stays for now)
-- ============================================================
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES public.team_members(id);

UPDATE public.bug_reports br
SET assigned_to_id = tm.id
FROM public.team_members tm
WHERE br.assigned_to_id IS NULL
  AND br.assigned_to IS NOT NULL
  AND LOWER(br.assigned_to) = LOWER(tm.name);

-- ============================================================
-- Phase 3f: team_funded_deals — add team_member_id FK
-- ============================================================
ALTER TABLE public.team_funded_deals
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES public.team_members(id);

UPDATE public.team_funded_deals tfd
SET team_member_id = tm.id
FROM public.team_members tm
WHERE tfd.team_member_id IS NULL
  AND LOWER(tfd.rep_name) = LOWER(tm.name);
