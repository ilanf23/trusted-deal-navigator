-- Drop the partner portal tables.
--
-- Context: the partner portal (separate /partner/* routes, sidebar, dashboard,
-- referrals, commissions, profile) was removed in the same change. The
-- partner_referrals and partner_tracking tables held data only that UI wrote
-- to, and both were empty in production. The `partner` value in the app_role
-- enum is intentionally left in place — dropping enum values is finicky and
-- the value is now simply unused.

drop table if exists public.partner_tracking cascade;
drop table if exists public.partner_referrals cascade;
