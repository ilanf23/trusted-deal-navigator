# AI Assistant Containment + Reporting Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the AI assistant from bypassing Supabase RLS via the service-role key, replace stale `leads`-table queries with the current `potential` / `underwriting` / `lender_management` deal model, and establish a canonical SQL reporting layer so the dashboard and the assistant compute identical financial numbers.

**Architecture:** Two Supabase clients per edge function — a *user-authenticated* client for all business-data reads/writes (so RLS applies) and a *service-role* client only for two narrow needs: decrypting the caller's OpenAI API key and writing audit rows. A new `ai_reporting` SQL layer (a `deals_v` view spanning the three pipeline tables, a `compute_deal_revenue` SQL function, and a small set of RPCs) becomes the single source of truth for pipeline/revenue numbers; both the dashboard hook and the assistant context call it. A new `ai_audit_log` table records every assistant data read/write with the calling user, tool, and scope.

**Tech Stack:** Supabase (Postgres + Edge Functions on Deno), TypeScript, `@supabase/supabase-js@2.45.0`, React + TanStack Query (dashboard side), `node-pg-migrate`-style raw-SQL migrations under `supabase/migrations/`.

**Out of scope (future plans):** Read-only AI reporting tools exposed as function-calling tools, permissioned document retrieval over `dropbox_files.extracted_text`, end-to-end RLS test harness, and rebuilding the broken `update_lead` / `bulk_update_leads` actions against the unified deal model. This plan only neutralises those actions with a clear error so they cannot silently corrupt data.

---

## File Structure

**New files:**
- `supabase/functions/_shared/userClient.ts` — factory returning `{ userClient, serviceClient }` from a request. `userClient` is bound to the caller's JWT (RLS on); `serviceClient` is unchanged.
- `supabase/functions/_shared/aiAgent/audit.ts` — `logAiAudit({ supabase, userId, conversationId, tool, scope, recordIds, mode, success })`.
- `supabase/migrations/20260527120000_ai_reporting_deals_view.sql` — `public.deals_v` view across the three pipeline tables.
- `supabase/migrations/20260527120100_ai_reporting_revenue_fn.sql` — `public.compute_deal_revenue(...)` SQL function.
- `supabase/migrations/20260527120200_ai_reporting_rpcs.sql` — `get_pipeline_value`, `get_funded_deals_summary`, `get_revenue_vs_target`, `get_invoice_summary` RPCs + `GRANT EXECUTE` to `authenticated`.
- `supabase/migrations/20260527120300_ai_audit_log.sql` — `public.ai_audit_log` table + RLS (insert-only for `authenticated`, select only for super_admin).
- `scripts/verify-ai-containment.sh` — bash + curl smoke test that hits each edge function as two different users and asserts scope leakage is blocked.

**Modified files:**
- `supabase/functions/ai-assistant-chat/index.ts` — switch to `userClient` for context reads, keep `serviceClient` only for `getProviderKey`.
- `supabase/functions/ai-assistant-agent/index.ts` — same split, plus replace `leads` query with `deals_v`.
- `supabase/functions/ai-assistant-actions/index.ts` — same split, undo/redo authorisation check.
- `supabase/functions/_shared/aiAgent/context.ts` — query `deals_v` instead of `leads`; aggregates come from the new RPCs.
- `supabase/functions/_shared/aiAgent/executor.ts` — neutralise `leads`-targeting actions with a structured error; add audit calls; tighten ownership check on `complete_task` and `undoChange`.
- `supabase/config.toml` — flip `verify_jwt = true` for the three `ai-assistant-*` functions.
- `src/components/admin/dashboard/useDashboardData.ts` — replace local `getDealRevenue` with a call to the SQL function for pipeline/revenue totals (keep the JS fallback only for per-row display in the UI).

---

## Task 1: User-scoped Supabase client helper

**Files:**
- Create: `supabase/functions/_shared/userClient.ts`

- [ ] **Step 1: Write the helper**

```ts
// supabase/functions/_shared/userClient.ts
// Returns one user-scoped client (RLS enforced) and one service-role client
// (RLS bypassed). Edge functions should use the user client for ALL business
// data and the service client only for narrow privileged needs
// (key decryption, audit writes).

import { createClient, type SupabaseClient } from './supabase.ts';

export interface RequestClients {
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
  authHeader: string;
}

export function getRequestClients(req: Request): RequestClients {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) throw new Error('No authorization header');

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { userClient, serviceClient, authHeader };
}
```

- [ ] **Step 2: Smoke-check the import path resolves**

Run: `deno check supabase/functions/_shared/userClient.ts`
Expected: exits 0 with no type errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/userClient.ts
git commit -m "feat(ai-assistant): add user-scoped supabase client helper"
```

---

## Task 2: Migration — unified `deals_v` view

**Files:**
- Create: `supabase/migrations/20260527120000_ai_reporting_deals_view.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260527120000_ai_reporting_deals_view.sql
-- Unified read-only view across the three deal pipeline tables. Inherits the
-- caller's RLS automatically because views respect the underlying tables'
-- policies (no SECURITY DEFINER here).

BEGIN;

CREATE OR REPLACE VIEW public.deals_v AS
  SELECT
    id,
    'potential'::text         AS pipeline,
    name,
    company_name,
    status,
    stage_id,
    assigned_to,
    deal_outcome,
    priority,
    deal_value,
    fee_percent,
    potential_revenue,
    net_revenue,
    actual_net_revenue,
    invoice_amount,
    source,
    referral_source,
    won_at,
    lost_at,
    close_date,
    target_closing_date,
    created_at,
    updated_at
  FROM public.potential
  UNION ALL
  SELECT
    id, 'underwriting', name, company_name, status, stage_id, assigned_to,
    deal_outcome, priority, deal_value, fee_percent, potential_revenue,
    net_revenue, actual_net_revenue, invoice_amount, source, referral_source,
    won_at, lost_at, close_date, target_closing_date, created_at, updated_at
  FROM public.underwriting
  UNION ALL
  SELECT
    id, 'lender_management', name, company_name, status, stage_id, assigned_to,
    deal_outcome, priority, deal_value, fee_percent, potential_revenue,
    net_revenue, actual_net_revenue, invoice_amount, source, referral_source,
    won_at, lost_at, close_date, target_closing_date, created_at, updated_at
  FROM public.lender_management;

GRANT SELECT ON public.deals_v TO authenticated;

COMMIT;
```

- [ ] **Step 2: Push the migration**

Run: `npm run db:push`
Expected: migration applies with no errors.

- [ ] **Step 3: Verify view returns rows scoped to the caller**

Run (in Supabase SQL editor or via `psql` with a user JWT):
```sql
SELECT pipeline, count(*) FROM public.deals_v GROUP BY pipeline;
```
Expected: row count per pipeline matches what the user can already see in `potential` / `underwriting` / `lender_management`. Should NOT exceed it.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260527120000_ai_reporting_deals_view.sql
git commit -m "feat(reporting): add unified deals_v view"
```

---

## Task 3: Migration — canonical revenue function

**Files:**
- Create: `supabase/migrations/20260527120100_ai_reporting_revenue_fn.sql`

- [ ] **Step 1: Write the function**

The JS implementation in `src/components/admin/dashboard/useDashboardData.ts:83-95` (`getDealRevenue`) is the contract: prefer `potential_revenue` if > 0, else `deal_value * (fee_percent / 100)`, else `deal_value * 0.02`.

```sql
-- 20260527120100_ai_reporting_revenue_fn.sql
-- Canonical revenue calc. Mirrors src/components/admin/dashboard/useDashboardData.ts
-- getDealRevenue(). Both dashboard SQL and AI reporting RPCs MUST call this.

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_deal_revenue(
  potential_revenue numeric,
  deal_value numeric,
  fee_percent numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN COALESCE(potential_revenue, 0) > 0
      THEN potential_revenue
    WHEN COALESCE(fee_percent, 0) > 0
      THEN COALESCE(deal_value, 0) * (fee_percent / 100.0)
    ELSE
      COALESCE(deal_value, 0) * 0.02
  END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_deal_revenue(numeric, numeric, numeric) TO authenticated;

COMMIT;
```

- [ ] **Step 2: Push and verify parity with JS**

Run: `npm run db:push`
Then in SQL editor:
```sql
SELECT id,
       compute_deal_revenue(potential_revenue, deal_value, fee_percent) AS revenue
FROM public.deals_v
ORDER BY revenue DESC
LIMIT 10;
```
Expected: numbers match what the dashboard already shows for those deals. If they don't, the JS `getDealRevenue` is the bug source, not this function — open an issue.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527120100_ai_reporting_revenue_fn.sql
git commit -m "feat(reporting): add canonical compute_deal_revenue SQL function"
```

---

## Task 4: Migration — reporting RPCs

**Files:**
- Create: `supabase/migrations/20260527120200_ai_reporting_rpcs.sql`

Note: `partner_commissions` does NOT exist in the current schema (only `partner_referrals`). Partner payout reporting is deferred to a follow-on plan.

- [ ] **Step 1: Write the RPCs**

```sql
-- 20260527120200_ai_reporting_rpcs.sql
-- Reporting RPCs. SECURITY INVOKER so the underlying RLS on potential /
-- underwriting / lender_management / invoices / revenue_targets applies to
-- the caller. The view + function from the previous two migrations do the
-- per-row filtering; these RPCs just shape the aggregate.

BEGIN;

-- Pipeline value, optionally narrowed by pipeline name or assignee.
CREATE OR REPLACE FUNCTION public.get_pipeline_value(
  p_pipeline text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL
)
RETURNS TABLE (
  pipeline text,
  open_count bigint,
  total_value numeric,
  total_expected_revenue numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    d.pipeline,
    count(*)::bigint AS open_count,
    COALESCE(sum(d.deal_value), 0) AS total_value,
    COALESCE(sum(public.compute_deal_revenue(d.potential_revenue, d.deal_value, d.fee_percent)), 0) AS total_expected_revenue
  FROM public.deals_v d
  WHERE (p_pipeline IS NULL OR d.pipeline = p_pipeline)
    AND (p_assigned_to IS NULL OR d.assigned_to = p_assigned_to)
    AND (d.deal_outcome = 'open' OR d.deal_outcome IS NULL)
  GROUP BY d.pipeline;
$$;

-- Funded (won) deals in a window.
CREATE OR REPLACE FUNCTION public.get_funded_deals_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_assigned_to uuid DEFAULT NULL
)
RETURNS TABLE (
  funded_count bigint,
  total_loan_value numeric,
  total_actual_net_revenue numeric,
  total_expected_revenue numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    count(*)::bigint AS funded_count,
    COALESCE(sum(d.deal_value), 0) AS total_loan_value,
    COALESCE(sum(d.actual_net_revenue), 0) AS total_actual_net_revenue,
    COALESCE(sum(public.compute_deal_revenue(d.potential_revenue, d.deal_value, d.fee_percent)), 0) AS total_expected_revenue
  FROM public.deals_v d
  WHERE d.deal_outcome = 'won'
    AND d.won_at >= p_from
    AND d.won_at <  p_to
    AND (p_assigned_to IS NULL OR d.assigned_to = p_assigned_to);
$$;

-- Revenue vs target. Global only — revenue_targets has no per-user dimension today.
CREATE OR REPLACE FUNCTION public.get_revenue_vs_target(
  p_period_type text
)
RETURNS TABLE (
  period_type text,
  target_amount numeric,
  actual_amount numeric,
  pace_vs_plan integer,
  forecast_amount numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    rt.period_type,
    rt.target_amount,
    rt.current_amount AS actual_amount,
    rt.pace_vs_plan,
    rt.forecast_amount
  FROM public.revenue_targets rt
  WHERE rt.period_type = p_period_type
  ORDER BY rt.updated_at DESC
  LIMIT 1;
$$;

-- Invoice summary.
CREATE OR REPLACE FUNCTION public.get_invoice_summary(
  p_status text DEFAULT NULL,
  p_overdue_only boolean DEFAULT false,
  p_min_amount numeric DEFAULT NULL
)
RETURNS TABLE (
  invoice_count bigint,
  total_amount numeric,
  overdue_count bigint,
  overdue_amount numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    count(*)::bigint AS invoice_count,
    COALESCE(sum(amount), 0) AS total_amount,
    count(*) FILTER (WHERE due_date < CURRENT_DATE AND paid_at IS NULL)::bigint AS overdue_count,
    COALESCE(sum(amount) FILTER (WHERE due_date < CURRENT_DATE AND paid_at IS NULL), 0) AS overdue_amount
  FROM public.invoices
  WHERE (p_status IS NULL OR status::text = p_status)
    AND (p_min_amount IS NULL OR amount >= p_min_amount)
    AND (NOT p_overdue_only OR (due_date < CURRENT_DATE AND paid_at IS NULL));
$$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_value(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_funded_deals_summary(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_vs_target(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_summary(text, boolean, numeric) TO authenticated;

COMMIT;
```

- [ ] **Step 2: Push and verify**

Run: `npm run db:push`
Then in SQL editor signed in as a super_admin:
```sql
SELECT * FROM public.get_pipeline_value(NULL, NULL);
SELECT * FROM public.get_funded_deals_summary(date_trunc('year', now()), now(), NULL);
SELECT * FROM public.get_revenue_vs_target('ytd');
SELECT * FROM public.get_invoice_summary(NULL, true, 25000);
```
Expected: each returns at least the shape defined, with totals that look sane vs. the existing dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527120200_ai_reporting_rpcs.sql
git commit -m "feat(reporting): add pipeline/funded/target/invoice RPCs"
```

---

## Task 5: Migration — `ai_audit_log` table

**Files:**
- Create: `supabase/migrations/20260527120300_ai_audit_log.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260527120300_ai_audit_log.sql
-- Append-only audit of AI assistant data reads and writes. The edge function
-- writes via the service-role client (bypassing RLS). Only super_admin can
-- read. authenticated has INSERT (used as a backup path; default path is
-- service-role).

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  user_id         uuid NOT NULL,
  conversation_id uuid,
  function_name   text NOT NULL,           -- ai-assistant-chat | -agent | -actions
  tool            text NOT NULL,           -- e.g. 'read_context', 'update_lead', 'get_pipeline_value'
  scope           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- filters used (member_id, pipeline, period)
  record_ids      uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  mode            text,                    -- 'chat' | 'assist' | 'agent'
  success         boolean NOT NULL,
  error_message   text
);

CREATE INDEX IF NOT EXISTS ai_audit_log_user_time_idx
  ON public.ai_audit_log (user_id, occurred_at DESC);

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can read ai_audit_log"
  ON public.ai_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "authenticated can insert their own ai_audit_log"
  ON public.ai_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMIT;
```

- [ ] **Step 2: Push and verify**

Run: `npm run db:push`
Then:
```sql
INSERT INTO public.ai_audit_log (user_id, function_name, tool, success)
VALUES (auth.uid(), 'manual-test', 'noop', true);
SELECT count(*) FROM public.ai_audit_log;
```
Expected: insert succeeds; the select returns >= 1 only if you're a super_admin.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527120300_ai_audit_log.sql
git commit -m "feat(reporting): add ai_audit_log table with super_admin-only RLS"
```

---

## Task 6: Audit helper

**Files:**
- Create: `supabase/functions/_shared/aiAgent/audit.ts`

- [ ] **Step 1: Write the helper**

```ts
// supabase/functions/_shared/aiAgent/audit.ts
import type { SupabaseClient } from '../supabase.ts';

export interface AuditInput {
  serviceClient: SupabaseClient;
  userId: string;
  conversationId?: string | null;
  functionName: 'ai-assistant-chat' | 'ai-assistant-agent' | 'ai-assistant-actions';
  tool: string;
  scope?: Record<string, unknown>;
  recordIds?: string[];
  mode?: 'chat' | 'assist' | 'agent';
  success: boolean;
  errorMessage?: string;
}

export async function logAiAudit(input: AuditInput): Promise<void> {
  try {
    await input.serviceClient.from('ai_audit_log').insert({
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      function_name: input.functionName,
      tool: input.tool,
      scope: input.scope ?? {},
      record_ids: input.recordIds ?? [],
      mode: input.mode ?? null,
      success: input.success,
      error_message: input.errorMessage ?? null,
    });
  } catch (e) {
    // Audit failures must never break the assistant. Log and move on.
    console.error('ai_audit_log insert failed:', e);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/aiAgent/audit.ts
git commit -m "feat(ai-assistant): add audit log helper"
```

---

## Task 7: Switch `ai-assistant-chat` to user-scoped client + audit

**Files:**
- Modify: `supabase/functions/ai-assistant-chat/index.ts`

- [ ] **Step 1: Replace the top-of-file client setup**

Replace lines 1-14 with:

```ts
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { getProviderKey } from '../_shared/userIntegrations.ts';
import { buildChatContext } from '../_shared/aiAgent/context.ts';
import { getRequestClients } from '../_shared/userClient.ts';
import { logAiAudit } from '../_shared/aiAgent/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

- [ ] **Step 2: Replace the handler body's client wiring**

Inside the `try {` block, replace the existing `const supabase = createClient(...)` and `getUserFromRequest(req, supabase)` lines with:

```ts
const { userClient, serviceClient } = getRequestClients(req);
const { teamMember, authUserId, isOwner } = await getUserFromRequest(req, userClient);
```

Then change the existing `getProviderKey(supabase, ...)` call to `getProviderKey(serviceClient, ...)` (key decryption needs service role) and change `buildChatContext(supabase, ...)` to `buildChatContext(userClient, ...)`.

- [ ] **Step 3: Add audit logging**

After the `contextData` line and again on the catch path:

```ts
await logAiAudit({
  serviceClient,
  userId: authUserId,
  functionName: 'ai-assistant-chat',
  tool: 'read_context',
  scope: { scopedMemberId, mode, currentPage },
  mode,
  success: true,
});
```

In the outer `catch (error)` block, before returning the 500, add:

```ts
try {
  const { serviceClient } = getRequestClients(req);
  await logAiAudit({
    serviceClient,
    userId: 'unknown',
    functionName: 'ai-assistant-chat',
    tool: 'read_context',
    success: false,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
} catch { /* never fail the response on audit error */ }
```

- [ ] **Step 4: Flip verify_jwt in config**

Edit `supabase/config.toml` lines 18-19:

```toml
[functions.ai-assistant-chat]
verify_jwt = true
```

- [ ] **Step 5: Deploy and smoke-test**

Run: `npm run functions:deploy`
Then call the function with a valid user JWT (use the browser session in DevTools → Network → copy-as-curl on a real chat request) and confirm:
- 200 with streaming response when the JWT is valid.
- 401 when the `Authorization` header is removed.
- `select count(*) from ai_audit_log where function_name = 'ai-assistant-chat'` increments by one per call.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ai-assistant-chat/index.ts supabase/config.toml
git commit -m "fix(ai-assistant-chat): use user-scoped client, enable verify_jwt, audit"
```

---

## Task 8: Rewrite `buildChatContext` against `deals_v` + RPCs

**Files:**
- Modify: `supabase/functions/_shared/aiAgent/context.ts`

The existing function queries a non-existent `leads` table and pulls 50 leads + 50 communications + 30 tasks + 20 notes + 20 appointments + 30 questionnaire rows + 20 email threads + 30 Dropbox files into the prompt. We're replacing the lead query with `deals_v`, scoping every collection by the caller's RLS, and replacing the JS-side pipeline aggregation with a single RPC call.

- [ ] **Step 1: Replace the lead query block (lines 17-22) with the unified view**

```ts
const { data: deals } = await supabase
  .from('deals_v')
  .select('id, pipeline, name, company_name, status, source, assigned_to, deal_outcome, priority, deal_value, potential_revenue, fee_percent, updated_at')
  .eq('assigned_to', scopedMemberId)
  .order('updated_at', { ascending: false })
  .limit(50);
```

- [ ] **Step 2: Scope every other query to the caller**

For `tasks`, `communications`, `notes`, `appointments`, `leadResponses`, `emailThreads`, `dropboxFiles` — add `.eq('user_id', scopedMemberId)` or the appropriate per-table assignee column. Because `userClient` already enforces RLS, this is defence-in-depth; some tables may not have an `assigned_to`/`user_id` column, in which case skip the explicit filter (RLS is doing the work).

Concrete edits per query:
- `tasks` already filters `is_completed=false`; add `.eq('user_id', scopedMemberId)`.
- `communications`: rename query to filter `.eq('user_id', scopedMemberId)` if column exists; otherwise filter by `deal_id` IN (deals.map(d => d.id)).
- `notes`, `appointments`, `lead_responses`, `email_threads`, `dropbox_files`: rely on RLS, but switch any `.eq('lead_id', ...)` to `.in('deal_id', dealIds)` where the table supports it. (If a table still uses `lead_id` as a column name pointing into `potential`, leave the column name and just filter on `dealIds`.)

- [ ] **Step 3: Replace the "Pipeline Summary" string-building with an RPC call**

Replace lines 75-82 (the inline `statusCounts` IIFE) with:

```ts
const { data: pipelineValue } = await supabase.rpc('get_pipeline_value', {
  p_pipeline: null,
  p_assigned_to: scopedMemberId,
});

const pipelineSection = pipelineValue?.map((row: any) =>
  `- ${row.pipeline}: ${row.open_count} open deals, $${Number(row.total_value).toLocaleString()} value, $${Number(row.total_expected_revenue).toLocaleString()} expected revenue`
).join('\n') || 'No pipeline data';
```

And update the template string from `### Pipeline Summary\n${...}` to use `${pipelineSection}`.

- [ ] **Step 4: Replace every `### Leads ...` heading and `leads?.map` call**

Search/replace `leads` → `deals` and `Lead` → `Deal` in the template strings and all `?.map`/`?.filter`/`?.find` callsites within this file. The lookup `leads?.find(l => l.id === t.lead_id)` becomes `deals?.find(d => d.id === t.deal_id ?? t.lead_id)` (some legacy task rows may still carry a `lead_id` column; tolerate both for now).

- [ ] **Step 5: Verify the file compiles**

Run: `deno check supabase/functions/_shared/aiAgent/context.ts`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/aiAgent/context.ts
git commit -m "fix(ai-assistant): query deals_v not leads, use reporting RPCs"
```

---

## Task 9: Switch `ai-assistant-agent` to user-scoped client + replace `leads` query

**Files:**
- Modify: `supabase/functions/ai-assistant-agent/index.ts`

- [ ] **Step 1: Replace client setup**

Same edits as Task 7 steps 1-2 (use `getRequestClients`, pass `userClient` to `getUserFromRequest`, pass `serviceClient` to `getProviderKey`).

- [ ] **Step 2: Replace the `leads` query with `deals_v`**

Replace lines 44-54 with:

```ts
let dealsQuery = userClient
  .from('deals_v')
  .select('id, pipeline, name, company_name, status, assigned_to, updated_at, deal_value, potential_revenue, fee_percent')
  .order('updated_at', { ascending: false })
  .limit(50);

if (!isOwner && memberId) {
  dealsQuery = dealsQuery.eq('assigned_to', memberId);
}

const { data: deals } = await dealsQuery;
```

- [ ] **Step 3: Update the prompt's context string and tool plumbing**

Replace `Available leads:` in the prompt with `Available deals:`. Update the `actionParams` mapping at lines 166-178: anywhere it reads `lead_id` from the model's tool call, also pass `pipeline` through so the executor knows which underlying table to hit:

```ts
if (fnName === "update_lead") {
  actionParams = { dealId: fnArgs.deal_id ?? fnArgs.lead_id, pipeline: fnArgs.pipeline ?? '', field: fnArgs.field, newValue: fnArgs.new_value };
}
```

- [ ] **Step 4: Add audit calls**

Wrap each `executeAction` call:

```ts
const result = await executeAction(/* ...existing args... */);

await logAiAudit({
  serviceClient,
  userId: authUserId,
  conversationId,
  functionName: 'ai-assistant-agent',
  tool: fnName,
  scope: { actionParams },
  recordIds: result.changeId ? [result.changeId] : [],
  mode: 'agent',
  success: result.success,
  errorMessage: result.success ? undefined : result.description,
});
```

- [ ] **Step 5: Flip verify_jwt**

Edit `supabase/config.toml` lines 15-16:

```toml
[functions.ai-assistant-agent]
verify_jwt = true
```

- [ ] **Step 6: Deploy and verify**

Run: `npm run functions:deploy`
Smoke test with a known user JWT — call the agent with `prompt: "what's in my pipeline"`. Expect a coherent response that references real deal rows, plus a new `ai_audit_log` row per tool call.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ai-assistant-agent/index.ts supabase/config.toml
git commit -m "fix(ai-assistant-agent): user-scoped client, deals_v, audit, verify_jwt"
```

---

## Task 10: Switch `ai-assistant-actions` + tighten undo authorisation

**Files:**
- Modify: `supabase/functions/ai-assistant-actions/index.ts`
- Modify: `supabase/functions/_shared/aiAgent/executor.ts`

- [ ] **Step 1: Replace client setup in actions/index.ts**

Same as Task 7 Steps 1-2.

- [ ] **Step 2: Tighten the undo authorisation**

In `supabase/functions/_shared/aiAgent/executor.ts`, replace the `undoChange` signature and the lookup at lines 271-281 with:

```ts
export async function undoChange(
  supabase: ReturnType<typeof createClient>,
  changeId: string,
  userId: string,
  isOwner: boolean,
) {
  const { data: change, error } = await supabase
    .from("ai_agent_changes")
    .select("*")
    .eq("id", changeId)
    .single();

  if (error || !change) throw new Error("Change not found");
  if (change.status !== "applied" && change.status !== "redone") {
    throw new Error(`Cannot undo change with status: ${change.status}`);
  }
  if (!isOwner && change.user_id !== userId) {
    throw new Error("Forbidden: cannot undo another user's change");
  }
  // ... rest unchanged
}
```

Update both `actions/index.ts` callers to pass `isOwner` through (`undo` and inside the `undo_batch` for-loop). For `undo_batch` also fetch the batch's `user_id` and gate the whole loop on `isOwner || batch.user_id === userId`.

- [ ] **Step 3: Neutralise stale `leads`-targeting actions in executor**

The `update_lead`, `bulk_update_leads`, and `log_activity` (with `lead_id`) actions in `executor.ts` query a `leads` table that no longer exists. They will fail at runtime — but with cryptic Postgres errors. Replace the body of each `case` with a structured error so the agent reports it cleanly:

```ts
case "update_lead":
case "bulk_update_leads":
case "log_activity": {
  return {
    success: false,
    description: `Action "${actionType}" must be rewritten against the deals_v model. Use a deal ID + pipeline (potential/underwriting/lender_management). Tracked in follow-on plan.`,
  };
}
```

(The `create_task`, `complete_task`, `create_note` cases stay — they target real tables. Add an `isOwner || teamMemberId === task.user_id` check inside `complete_task` before the update, mirroring the existing check in `update_lead`.)

- [ ] **Step 4: Add audit calls in actions/index.ts**

After each `result = await executeAction(...)`, each `undoChange(...)`, and each `redoChange(...)`, call `logAiAudit` with `functionName: 'ai-assistant-actions'`, the appropriate `tool` name, and the result's success flag.

- [ ] **Step 5: Flip verify_jwt**

Edit `supabase/config.toml` lines 12-13:

```toml
[functions.ai-assistant-actions]
verify_jwt = true
```

- [ ] **Step 6: Deploy and smoke-test**

Run: `npm run functions:deploy`

Manually:
1. As user A, trigger an action (create_task is safe) and capture the returned `changeId`.
2. As user B (different non-owner), POST `{action:'undo', changeId}` to the function. Expect a 200 with `{success:false}` and a "Forbidden" message.
3. As user A again, undo the same change. Expect success.
4. `select count(*) from ai_audit_log where function_name = 'ai-assistant-actions'` increments accordingly.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ai-assistant-actions/index.ts supabase/functions/_shared/aiAgent/executor.ts supabase/config.toml
git commit -m "fix(ai-assistant-actions): owner check on undo, neutralise stale leads actions, audit"
```

---

## Task 11: Wire dashboard to the canonical SQL revenue function

**Files:**
- Modify: `src/components/admin/dashboard/useDashboardData.ts`

We're not removing the JS `getDealRevenue` — per-row UI rendering still uses it. We are replacing the in-memory aggregate calls (whatever inside `useDashboardData` sums revenue across all deals) with a single `supabase.rpc('get_pipeline_value', { p_pipeline: null, p_assigned_to: null })` so the dashboard total and the AI's "pipeline expected revenue" stat come from the same place.

- [ ] **Step 1: Add a React Query for pipeline value totals**

Add near the top of the data hook:

```ts
const { data: pipelineTotalsByPipeline } = useQuery({
  queryKey: ['dashboard', 'pipelineValue'],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_pipeline_value', {
      p_pipeline: null,
      p_assigned_to: null,
    });
    if (error) throw error;
    return data ?? [];
  },
});

const pipelineExpectedRevenue = (pipelineTotalsByPipeline ?? [])
  .reduce((sum: number, row: any) => sum + Number(row.total_expected_revenue || 0), 0);
```

- [ ] **Step 2: Replace any existing in-memory aggregate that sums `getDealRevenue` across all deals**

Find the line(s) in `useDashboardData.ts` that compute a portfolio-wide pipeline revenue by mapping `getDealRevenue` over a deals array, and substitute `pipelineExpectedRevenue`. Per-row UI still uses `getDealRevenue` — only the aggregate is centralised.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`
Open the superadmin dashboard. The "pipeline value" / "expected revenue" tile should equal `sum(total_expected_revenue)` from the RPC. If it differs, the discrepancy reveals a real bug in either the JS or SQL implementation — investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/dashboard/useDashboardData.ts
git commit -m "feat(dashboard): use get_pipeline_value RPC for aggregate revenue"
```

---

## Task 12: End-to-end verification script

**Files:**
- Create: `scripts/verify-ai-containment.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# scripts/verify-ai-containment.sh
# Smoke test: containment is in place after deploy.
# Requires: SUPABASE_URL, USER_A_JWT (non-owner), USER_B_JWT (non-owner, different),
# OWNER_JWT (super_admin) in the environment.

set -euo pipefail
: "${SUPABASE_URL:?need SUPABASE_URL}"
: "${USER_A_JWT:?need USER_A_JWT}"
: "${USER_B_JWT:?need USER_B_JWT}"
: "${OWNER_JWT:?need OWNER_JWT}"

CHAT_URL="$SUPABASE_URL/functions/v1/ai-assistant-chat"

echo "1. No-auth call to chat must 401"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$CHAT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}')
test "$code" = "401" || { echo "expected 401, got $code"; exit 1; }

echo "2. User A asks 'list all my deals'"
curl -s -X POST "$CHAT_URL" \
  -H "Authorization: Bearer $USER_A_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"list every deal you can see"}]}' \
  > /tmp/user_a_response.txt

echo "3. User B asks 'list all my deals'"
curl -s -X POST "$CHAT_URL" \
  -H "Authorization: Bearer $USER_B_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"list every deal you can see"}]}' \
  > /tmp/user_b_response.txt

echo "4. Diff the two responses — they MUST differ (different RLS scope)"
if diff -q /tmp/user_a_response.txt /tmp/user_b_response.txt > /dev/null; then
  echo "FAIL: both users see identical data — RLS scope leakage"
  exit 1
fi

echo "5. Owner gets larger scope"
owner_size=$(curl -s -X POST "$CHAT_URL" \
  -H "Authorization: Bearer $OWNER_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"list every deal you can see"}]}' | wc -c)
user_size=$(wc -c < /tmp/user_a_response.txt)
test "$owner_size" -gt "$user_size" || { echo "FAIL: owner response not larger than user"; exit 1; }

echo "All containment checks passed."
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/verify-ai-containment.sh`

- [ ] **Step 3: Run it**

Run (after exporting the three JWTs from `localStorage` of three distinct browser sessions):
```
./scripts/verify-ai-containment.sh
```
Expected: exits 0 with "All containment checks passed."

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-ai-containment.sh
git commit -m "test(ai-assistant): add containment smoke verification script"
```

---

## Self-Review Notes

Coverage against the source analysis:

| Source-analysis item | Task |
|---|---|
| Stop service-role queries in chat/agent for business reads | 1, 7, 9 |
| Correct stale `leads` usage | 8 (context), 9 (agent), 10 (executor neutralise) |
| Fix task/action/undo authorization | 10 |
| Review `verify_jwt = false` for AI functions | 7, 9, 10 (all three flipped) |
| Unified deal reporting across three pipeline tables | 2 |
| Canonical revenue calculation | 3, 11 |
| Pipeline / funded / target / invoice RPCs | 4 |
| Audit table + writes | 5, 6, 7, 9, 10 |
| Dashboard parity with reporting layer | 11 |
| Verification harness | 12 |

Deferred (explicit out-of-scope, follow-on plans):
- Read-only AI tools (`get_financial_summary`, `get_revenue_vs_target`, etc.) exposed as OpenAI function-calling tools. The RPCs from Task 4 are the foundation they'll call.
- Document retrieval over `dropbox_files.extracted_text` with permissioned scope.
- Rebuilding `update_lead`/`bulk_update_leads`/`log_activity` actions against `deals_v` (Task 10 neutralises them with a structured error; the rebuild is its own plan).
- Per-user RLS narrowing on the deal tables themselves (today the policy is admin/super_admin can do anything; narrowing to per-assignee for non-owners is its own change with broader product implications).
- `partner_commissions` reporting — table does not yet exist in the schema.

No placeholders. Every step has either real code, a real SQL statement, or a specific command + expected output.
