-- 20260604121000_ai_read_sql.sql
-- Owner-only live SQL read access for the CLX Assistant.
--
-- Security model:
--   * run_read_sql is SECURITY DEFINER (owned by postgres) so it can bypass
--     per-row RLS and verify the caller — founders see ALL company data.
--   * It self-verifies the caller is a founder via auth.uid() -> users.is_owner
--     (or super_admin). Non-founders are rejected even if the edge function
--     gate is bypassed.
--   * It SET ROLEs to clx_ai_readonly before executing the dynamic query.
--     That role has SELECT on ONLY the allowlisted business tables and no
--     write grants anywhere, so the table allowlist and read-only-ness are
--     enforced by Postgres itself, not by string parsing.
--   * Statement timeout (5s) + row cap (500) bound cost.

BEGIN;

-- 1. Read-only role. NOLOGIN: only reachable via SET ROLE from the definer fn.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clx_ai_readonly') THEN
    CREATE ROLE clx_ai_readonly NOLOGIN;
  END IF;
END $$;

-- postgres must be a member of the role to SET ROLE to it inside the fn.
GRANT clx_ai_readonly TO postgres;

-- 2. Table allowlist == the SELECT grants on this role. To add/remove a table
--    from the assistant's reach, add/remove one GRANT line and re-deploy.
GRANT USAGE ON SCHEMA public TO clx_ai_readonly;
-- NOTE: schema reflects the post-consolidation DB. The former potential /
-- underwriting / lender_management tables and the deals_v view were dropped
-- and replaced by a single public.deals table; partner_referrals and
-- deal_responses were dropped with their features. See the consolidate-deal
-- migrations (20260528180000..220100).
GRANT SELECT ON
  public.deals,
  public.tasks,
  public.communications,
  public.appointments,
  public.email_threads,
  public.dropbox_files,
  public.invoices,
  public.lender_programs,
  public.deal_lender_programs,
  public.revenue_targets,
  public.rate_watch,
  public.people,
  public.company_people,
  public.users
TO clx_ai_readonly;

-- 3. The RPC.
CREATE OR REPLACE FUNCTION public.run_read_sql(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_founder boolean;
  v_result jsonb;
  v_clean text;
BEGIN
  -- Founder self-check. auth.uid() comes from the caller's JWT and survives
  -- SET ROLE, but we check it up front as the definer (can read users).
  SELECT (u.is_owner = true OR u.app_role = 'super_admin')
    INTO v_is_founder
  FROM public.users u
  WHERE u.user_id = auth.uid();

  IF v_is_founder IS NOT TRUE THEN
    RAISE EXCEPTION 'run_read_sql is restricted to founders';
  END IF;

  -- Strip a single trailing semicolon; reject internal ones (chaining).
  v_clean := regexp_replace(btrim(p_query), ';\s*$', '');
  IF position(';' in v_clean) > 0 THEN
    RAISE EXCEPTION 'multiple statements are not allowed';
  END IF;

  -- Must be a read query.
  IF lower(btrim(v_clean)) !~ '^(select|with)\s' THEN
    RAISE EXCEPTION 'only SELECT/WITH queries are allowed';
  END IF;

  -- Bound cost for this statement only.
  SET LOCAL statement_timeout = '5s';

  -- Switch to the least-privileged role: its grants are the allowlist, and it
  -- has no write privileges, so non-allowlisted tables / writes fail here.
  SET LOCAL ROLE clx_ai_readonly;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (SELECT * FROM (%s) q LIMIT 500) t',
    v_clean
  ) INTO v_result;

  RESET ROLE;
  RETURN v_result;
END;
$$;

-- Only authenticated users may invoke; the fn itself enforces founder-only.
REVOKE ALL ON FUNCTION public.run_read_sql(text) FROM public;
GRANT EXECUTE ON FUNCTION public.run_read_sql(text) TO authenticated;

COMMIT;
