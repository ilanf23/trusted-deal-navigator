# CLX Assistant — Database Query Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CLX Assistant's static context snapshot with a live tool-calling read loop so users can ask arbitrary questions about the database and get accurate, query-derived answers.

**Architecture:** `ai-assistant-chat` runs a two-phase loop: (1) a non-streaming tool-resolution phase where the LLM calls curated read tools and an owner-only guarded SQL fallback, then (2) a streaming phase that pipes the final natural-language answer to the unchanged frontend. Founders (`users.is_owner`/`super_admin`) get company-wide reads and raw SQL; everyone else gets curated tools auto-scoped to their own data. Curated tools run through the service-role client with scope enforced in code; the SQL fallback runs through the user client so the RPC can self-verify the founder via `auth.uid()`, then `SET ROLE` to a read-only role whose table grants ARE the allowlist.

**Tech Stack:** Supabase (Postgres + Deno edge functions), OpenRouter (OpenAI-compatible wire format), React (frontend unchanged except suggestion chips).

**Spec:** `docs/superpowers/specs/2026-06-04-clx-assistant-database-query-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260604120000_ai_read_sql.sql` (create) | `clx_ai_readonly` role + table-grant allowlist + `run_read_sql` SECURITY DEFINER RPC with founder self-check, single-SELECT guard, read-only txn, timeout, row cap |
| `supabase/functions/_shared/aiAgent/sqlGuard.ts` (create) | Pure, testable validator: accepts a string, returns `{ ok, reason }` — rejects anything that isn't a single read-only `SELECT` |
| `supabase/functions/_shared/aiAgent/sqlGuard.test.ts` (create) | Deno unit tests for the validator |
| `supabase/functions/_shared/aiAgent/readTools.ts` (create) | 6 read-tool schemas + executors; scope helper; founder/rep gating |
| `supabase/functions/_shared/auth.ts` (modify) | Add `isFounder` (from `is_owner` column OR `super_admin`) to `ResolvedAuth` |
| `supabase/functions/ai-assistant-chat/index.ts` (modify) | Swap snapshot prompt for the two-phase tool-calling loop |
| `src/components/ai/CLXAssistantEmptyState.tsx` (modify) | New suggestion chips advertising query power |

The existing `_shared/aiAgent/context.ts` (`buildChatContext`) stops being called by chat but is left in place (still imported by nothing else after this change — deletion is out of scope to keep the diff focused).

---

## Task 1: Add `isFounder` to the auth helper

**Files:**
- Modify: `supabase/functions/_shared/auth.ts:44` (select) and `:48-63` (derive + return)

- [ ] **Step 1: Add `is_owner` to the users select and derive `isFounder`**

In `getUserFromRequest`, change the select to include `is_owner`:

```ts
  const { data: teamMember } = await supabase
    .from('users')
    .select('id, name, email, app_role, is_owner')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = teamMember?.app_role ?? null;
  const isOwner = role === 'admin' || role === 'super_admin';
  // Founder = authoritative is_owner column OR super_admin. Distinct from the
  // loose isOwner above, which (intentionally, for write flows) also treats
  // employee `admin`s as owners. Founder gates company-wide reads + raw SQL.
  const isFounder = teamMember?.is_owner === true || role === 'super_admin';
```

- [ ] **Step 2: Add `isFounder` to the `ResolvedAuth` interface**

Find the `ResolvedAuth` interface (near the top, alongside `isOwner: boolean;`) and add:

```ts
  isFounder: boolean;
```

- [ ] **Step 3: Return `isFounder`**

In the returned object (alongside `isOwner,`) add:

```ts
    isFounder,
```

- [ ] **Step 4: Type-check the function compiles**

Run: `deno check supabase/functions/_shared/auth.ts`
Expected: no errors (exits 0).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/auth.ts
git commit -m "feat(ai): add isFounder gate to edge auth helper"
```

---

## Task 2: SQL guard validator (pure, TDD)

The validator is the only piece of `run_read_sql` logic we can unit-test in isolation. It is a defense-in-depth layer; the real security boundary is the `clx_ai_readonly` role grants (Task 3).

**Files:**
- Create: `supabase/functions/_shared/aiAgent/sqlGuard.ts`
- Test: `supabase/functions/_shared/aiAgent/sqlGuard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/aiAgent/sqlGuard.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateReadOnlySql } from "./sqlGuard.ts";

Deno.test("accepts a plain SELECT", () => {
  assertEquals(validateReadOnlySql("SELECT * FROM deals_v").ok, true);
});

Deno.test("accepts SELECT with leading whitespace/comments stripped", () => {
  assertEquals(validateReadOnlySql("  \n SELECT count(*) FROM tasks").ok, true);
});

Deno.test("accepts a WITH (CTE) read query", () => {
  assertEquals(validateReadOnlySql("WITH x AS (SELECT 1) SELECT * FROM x").ok, true);
});

Deno.test("rejects INSERT", () => {
  assertEquals(validateReadOnlySql("INSERT INTO tasks (title) VALUES ('x')").ok, false);
});

Deno.test("rejects UPDATE/DELETE/DROP/ALTER/GRANT/TRUNCATE/COPY", () => {
  for (const q of [
    "UPDATE tasks SET title='x'",
    "DELETE FROM tasks",
    "DROP TABLE tasks",
    "ALTER TABLE tasks ADD COLUMN y int",
    "GRANT ALL ON tasks TO public",
    "TRUNCATE tasks",
    "COPY tasks TO '/tmp/x'",
  ]) {
    assertEquals(validateReadOnlySql(q).ok, false, q);
  }
});

Deno.test("rejects statement chaining via semicolon", () => {
  assertEquals(validateReadOnlySql("SELECT 1; DROP TABLE tasks").ok, false);
});

Deno.test("allows a single trailing semicolon", () => {
  assertEquals(validateReadOnlySql("SELECT 1;").ok, true);
});

Deno.test("rejects a write keyword hidden after a CTE", () => {
  assertEquals(validateReadOnlySql("WITH x AS (SELECT 1) DELETE FROM tasks").ok, false);
});

Deno.test("rejects empty/blank input", () => {
  assertEquals(validateReadOnlySql("   ").ok, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/_shared/aiAgent/sqlGuard.test.ts`
Expected: FAIL — `Module not found` / `validateReadOnlySql is not exported`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// supabase/functions/_shared/aiAgent/sqlGuard.ts
// Pure, defense-in-depth validator for the owner-only run_read_sql fallback.
// The authoritative security boundary is the clx_ai_readonly role's table
// grants (see migration 20260604120000_ai_read_sql.sql). This just gives
// clean, early rejections for obviously-unsafe input.

export interface SqlGuardResult {
  ok: boolean;
  reason?: string;
}

// Keywords that must never appear as statements in a read-only query.
const FORBIDDEN = [
  "insert", "update", "delete", "drop", "alter", "grant", "revoke",
  "truncate", "copy", "create", "comment", "vacuum", "analyze",
  "merge", "call", "do", "set", "reset", "begin", "commit", "rollback",
];

export function validateReadOnlySql(raw: string): SqlGuardResult {
  if (!raw || !raw.trim()) return { ok: false, reason: "empty query" };

  // Strip line and block comments so they can't hide keywords.
  const noComments = raw
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");

  const trimmed = noComments.trim();

  // Allow at most one trailing semicolon; reject any internal one (chaining).
  const withoutTrailing = trimmed.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return { ok: false, reason: "multiple statements are not allowed" };
  }

  const lower = withoutTrailing.toLowerCase();

  // Must start with SELECT or WITH (read CTE).
  if (!/^(select|with)\b/.test(lower)) {
    return { ok: false, reason: "only SELECT/WITH queries are allowed" };
  }

  // Reject forbidden keywords appearing as whole words anywhere.
  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`).test(lower)) {
      return { ok: false, reason: `forbidden keyword: ${kw}` };
    }
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/_shared/aiAgent/sqlGuard.test.ts`
Expected: PASS (all tests ok).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/aiAgent/sqlGuard.ts supabase/functions/_shared/aiAgent/sqlGuard.test.ts
git commit -m "feat(ai): read-only SQL guard validator with tests"
```

---

## Task 3: Migration — read-only role + `run_read_sql` RPC

**Files:**
- Create: `supabase/migrations/20260604120000_ai_read_sql.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260604120000_ai_read_sql.sql
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
GRANT SELECT ON
  public.deals_v,
  public.potential,
  public.underwriting,
  public.lender_management,
  public.tasks,
  public.communications,
  public.appointments,
  public.email_threads,
  public.deal_responses,
  public.dropbox_files,
  public.invoices,
  public.partner_referrals,
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
```

- [ ] **Step 2: Apply the migration to remote**

Run: `npm run db:push`
Expected: migration `20260604120000_ai_read_sql` applies without error.

- [ ] **Step 3: Verify founder gate + allowlist via SQL**

Open the Supabase SQL editor (or psql) and run these as checks. Because `auth.uid()` is null in the bare SQL editor, the founder check returns NULL → rejects, which proves the gate is closed by default:

```sql
-- Expect: ERROR "run_read_sql is restricted to founders" (auth.uid() is null here)
SELECT public.run_read_sql('SELECT 1');
```

Then verify the role grants directly (this is the real allowlist boundary):

```sql
-- Expect: a row for each allowlisted table, NONE for e.g. user_integrations
SET ROLE clx_ai_readonly;
SELECT count(*) FROM public.deals_v;        -- works
-- Expect: ERROR permission denied for table user_integrations
SELECT count(*) FROM public.user_integrations;
RESET ROLE;
```

Expected: first call errors with the founder message; `deals_v` count succeeds under the role; `user_integrations` is permission-denied.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260604120000_ai_read_sql.sql
git commit -m "feat(ai): read-only role + run_read_sql RPC for founder DB queries"
```

---

## Task 4: Read tools module

**Files:**
- Create: `supabase/functions/_shared/aiAgent/readTools.ts`

- [ ] **Step 1: Write the tool schemas + scope helper**

```ts
// supabase/functions/_shared/aiAgent/readTools.ts
// Read-tool definitions + executors for the CLX Assistant chat loop.
// Curated tools run via the service-role client with scope enforced in code:
// founders are unscoped (company-wide); everyone else is forced to their own
// assigned_to. run_read_sql is founder-only and runs via the USER client so
// the RPC can resolve auth.uid().

import type { SupabaseClient } from "../supabase.ts";
import { validateReadOnlySql } from "./sqlGuard.ts";

export interface ReadToolContext {
  serviceClient: SupabaseClient; // RLS-bypassing; scope enforced in code below
  userClient: SupabaseClient;    // carries caller JWT; used only for run_read_sql
  isFounder: boolean;
  memberId: string | null;       // the caller's users.id (for rep scoping)
}

// OpenAI/OpenRouter function-calling schemas exposed to the model.
export function readToolSchemas(isFounder: boolean) {
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "query_deals",
        description: "List deals filtered by pipeline, status, outcome, value range, or update date. Returns deal rows.",
        parameters: {
          type: "object",
          properties: {
            pipeline: { type: "string", enum: ["potential", "underwriting", "lender_management"] },
            status: { type: "string", description: "Exact status value to match" },
            outcome: { type: "string", enum: ["open", "won", "lost", "abandoned"] },
            min_value: { type: "number", description: "Minimum deal_value" },
            updated_within_days: { type: "number", description: "Only deals updated within the last N days" },
            limit: { type: "number", description: "Max rows (default 50, max 200)" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_metrics",
        description: "Aggregate pipeline metrics: open counts, total value, and expected revenue, grouped by pipeline. Optionally narrow to one pipeline.",
        parameters: {
          type: "object",
          properties: {
            pipeline: { type: "string", enum: ["potential", "underwriting", "lender_management"], description: "Optional pipeline filter" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "search_communications",
        description: "Find recent communications (calls/emails/notes) optionally filtered by deal/lead id, type, or a keyword in the content/transcript.",
        parameters: {
          type: "object",
          properties: {
            lead_id: { type: "string", description: "Optional deal/lead UUID" },
            communication_type: { type: "string", description: "e.g. call, email, sms, note" },
            keyword: { type: "string", description: "Case-insensitive substring to match in content/transcript" },
            limit: { type: "number", description: "Max rows (default 30, max 100)" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "lookup_lead",
        description: "Get a 360 view of one deal/lead: the deal row, its open tasks, recent communications, and questionnaire responses.",
        parameters: {
          type: "object",
          properties: {
            lead_id: { type: "string", description: "The deal/lead UUID" },
          },
          required: ["lead_id"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "query_tasks",
        description: "List tasks filtered by completion, priority, or due-date window.",
        parameters: {
          type: "object",
          properties: {
            is_completed: { type: "boolean", description: "Default false (pending tasks)" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            overdue_only: { type: "boolean", description: "Only tasks past their due_date" },
            limit: { type: "number", description: "Max rows (default 50, max 200)" },
          },
        },
      },
    },
  ];

  if (isFounder) {
    tools.push({
      type: "function" as const,
      function: {
        name: "run_read_sql",
        description: "Founder-only. Run an arbitrary READ-ONLY SQL SELECT against the business database when no other tool fits. Use standard Postgres. Allowlisted tables: deals_v, potential, underwriting, lender_management, tasks, communications, appointments, email_threads, deal_responses, dropbox_files, invoices, partner_referrals, lender_programs, deal_lender_programs, revenue_targets, rate_watch, people, company_people, users. Results are capped at 500 rows.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "A single read-only SELECT or WITH query." },
          },
          required: ["query"],
        },
      },
    } as any);
  }

  return tools;
}
```

- [ ] **Step 2: Add the executor (append to the same file)**

```ts
// Clamp helper for caller-supplied limits.
function clampLimit(n: unknown, def: number, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : def;
  return Math.max(1, Math.min(max, v));
}

// Apply rep scoping: founders unscoped, everyone else forced to own assigned_to.
function scopeDeals(query: any, ctx: ReadToolContext) {
  return ctx.isFounder || !ctx.memberId ? query : query.eq("assigned_to", ctx.memberId);
}

export async function executeReadTool(
  ctx: ReadToolContext,
  name: string,
  args: Record<string, any>,
): Promise<unknown> {
  const svc = ctx.serviceClient;

  switch (name) {
    case "query_deals": {
      let q = svc.from("deals_v").select(
        "id, pipeline, name, company_name, status, deal_outcome, priority, deal_value, potential_revenue, assigned_to, updated_at",
      );
      q = scopeDeals(q, ctx);
      if (args.pipeline) q = q.eq("pipeline", args.pipeline);
      if (args.status) q = q.eq("status", args.status);
      if (args.outcome) q = q.eq("deal_outcome", args.outcome);
      if (typeof args.min_value === "number") q = q.gte("deal_value", args.min_value);
      if (typeof args.updated_within_days === "number") {
        const since = new Date(Date.now() - args.updated_within_days * 86400000).toISOString();
        q = q.gte("updated_at", since);
      }
      q = q.order("updated_at", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { rows: data, count: data?.length ?? 0 };
    }

    case "get_metrics": {
      // Reuse the existing SECURITY INVOKER RPC via the service client. Pass
      // p_assigned_to to scope reps; null for founders (company-wide).
      const { data, error } = await svc.rpc("get_pipeline_value", {
        p_pipeline: args.pipeline ?? null,
        p_assigned_to: ctx.isFounder ? null : ctx.memberId,
      });
      if (error) return { error: error.message };
      return { metrics: data };
    }

    case "search_communications": {
      let q = svc.from("communications").select(
        "id, lead_id, communication_type, direction, created_at, content, transcript, duration_seconds, phone_number",
      );
      if (args.lead_id) q = q.eq("lead_id", args.lead_id);
      if (args.communication_type) q = q.eq("communication_type", args.communication_type);
      if (args.keyword) q = q.or(`content.ilike.%${args.keyword}%,transcript.ilike.%${args.keyword}%`);
      q = q.order("created_at", { ascending: false }).limit(clampLimit(args.limit, 30, 100));
      const { data, error } = await q;
      if (error) return { error: error.message };
      // Reps can only see comms tied to their own deals. Resolve allowed deal ids.
      if (!ctx.isFounder && ctx.memberId) {
        const { data: mine } = await svc.from("deals_v").select("id").eq("assigned_to", ctx.memberId);
        const allowed = new Set((mine ?? []).map((d: any) => d.id));
        return { rows: (data ?? []).filter((c: any) => !c.lead_id || allowed.has(c.lead_id)) };
      }
      return { rows: data };
    }

    case "lookup_lead": {
      if (!args.lead_id) return { error: "lead_id is required" };
      let dealQ = svc.from("deals_v").select("*").eq("id", args.lead_id);
      dealQ = scopeDeals(dealQ, ctx);
      const { data: deal } = await dealQ.maybeSingle();
      if (!deal) return { error: "Deal not found or not visible to you" };
      const [{ data: tasks }, { data: comms }, { data: responses }] = await Promise.all([
        svc.from("tasks").select("id, title, status, priority, due_date").eq("lead_id", args.lead_id).eq("is_completed", false),
        svc.from("communications").select("communication_type, direction, created_at, content, transcript").eq("lead_id", args.lead_id).order("created_at", { ascending: false }).limit(20),
        svc.from("deal_responses").select("*").eq("lead_id", args.lead_id).limit(5),
      ]);
      return { deal, tasks, communications: comms, responses };
    }

    case "query_tasks": {
      let q = svc.from("tasks").select("id, title, status, priority, due_date, is_completed, lead_id, user_id");
      if (!ctx.isFounder && ctx.memberId) q = q.eq("user_id", ctx.memberId);
      q = q.eq("is_completed", args.is_completed === true ? true : false);
      if (args.priority) q = q.eq("priority", args.priority);
      if (args.overdue_only) q = q.lt("due_date", new Date().toISOString());
      q = q.order("due_date", { ascending: true }).limit(clampLimit(args.limit, 50, 200));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { rows: data };
    }

    case "run_read_sql": {
      if (!ctx.isFounder) return { error: "run_read_sql is restricted to founders" };
      const guard = validateReadOnlySql(String(args.query ?? ""));
      if (!guard.ok) return { error: `Rejected: ${guard.reason}` };
      // Must use the USER client so the RPC's auth.uid() resolves to the caller.
      const { data, error } = await ctx.userClient.rpc("run_read_sql", { p_query: args.query });
      if (error) return { error: error.message };
      return { rows: data };
    }

    default:
      return { error: `Unknown read tool: ${name}` };
  }
}
```

- [ ] **Step 3: Type-check**

Run: `deno check supabase/functions/_shared/aiAgent/readTools.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/aiAgent/readTools.ts
git commit -m "feat(ai): curated read tools + founder SQL fallback executor"
```

---

## Task 5: Rewrite `ai-assistant-chat` as a tool-calling loop

**Files:**
- Modify: `supabase/functions/ai-assistant-chat/index.ts`

- [ ] **Step 1: Replace imports and context build**

Replace the `buildChatContext` import line:

```ts
import { buildChatContext } from '../_shared/aiAgent/context.ts';
```

with:

```ts
import { readToolSchemas, executeReadTool, type ReadToolContext } from '../_shared/aiAgent/readTools.ts';
```

- [ ] **Step 2: Pull `isFounder` from auth and build a starter context (no snapshot)**

Replace the block that destructures auth and builds `contextData` (the
`const { teamMember, authUserId, isOwner } = ...` line through the
`const contextData = await buildChatContext(...)` line) with:

```ts
    const { teamMember, authUserId, isOwner, isFounder } = await getUserFromRequest(req, userClient);
```

and delete the `const contextData = await buildChatContext(userClient, scopedMemberId, displayName);` line. Replace the later `${contextData}` interpolations (in both the `assist` and `else` branches of `systemPrompt`) with `${starterContext}`, and add this above the `systemPrompt` assignment:

```ts
    const starterContext = `## How to answer
You do NOT have the data in front of you. To answer ANY question about deals,
tasks, communications, pipeline, revenue, or leads, you MUST call the provided
read tools to fetch live data first, then answer from the results. Never invent
numbers. ${isFounder
  ? 'You may use run_read_sql for arbitrary questions the other tools do not cover.'
  : 'You can only see this user\\'s own assigned data.'}
Today: ${new Date().toISOString().split('T')[0]}`;
```

- [ ] **Step 3: Replace the single streaming fetch with the two-phase loop**

Replace the whole block from `const response = await fetch(LLM_CHAT_ENDPOINT, {` down to the `return new Response(response.body, { ... })` (the success return) with the following. Phase 1 resolves tools (non-streaming); Phase 2 streams the final answer with tools disabled, piping OpenRouter's body straight to the unchanged frontend SSE parser:

```ts
    const toolCtx: ReadToolContext = {
      serviceClient,
      userClient,
      isFounder,
      memberId: scopedMemberId ?? null,
    };
    const tools = readToolSchemas(isFounder);

    const convo: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // --- Phase 1: resolve tool calls (non-streaming) ---
    const maxIterations = 5;
    for (let i = 0; i < maxIterations; i++) {
      const toolResp = await fetch(LLM_CHAT_ENDPOINT, {
        method: "POST",
        headers: llmHeaders(LLM_API_KEY),
        body: JSON.stringify({ model: LLM_MODEL, messages: convo, tools, tool_choice: "auto" }),
      });
      if (!toolResp.ok) {
        const errText = await toolResp.text();
        return new Response(JSON.stringify({ error: "LLM error: " + errText }), {
          status: toolResp.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const toolData = await toolResp.json();
      const msg = toolData.choices?.[0]?.message;
      convo.push(msg);
      if (!msg?.tool_calls?.length) break;

      for (const call of msg.tool_calls) {
        let result: unknown;
        try {
          result = await executeReadTool(toolCtx, call.function.name, JSON.parse(call.function.arguments || "{}"));
        } catch (e) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }
        await logAiAudit({
          serviceClient,
          userId: authUserId,
          functionName: 'ai-assistant-chat',
          tool: call.function.name,
          scope: { args: call.function.arguments, isFounder },
          mode: 'chat',
          success: !(result as any)?.error,
          errorMessage: (result as any)?.error,
        });
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    // --- Phase 2: stream the final answer (tools disabled) ---
    const response = await fetch(LLM_CHAT_ENDPOINT, {
      method: "POST",
      headers: llmHeaders(LLM_API_KEY),
      body: JSON.stringify({ model: LLM_MODEL, messages: convo, tool_choice: "none", stream: true }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("LLM API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "LLM API error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
```

Note: the existing `read_context` audit-log call near the top can stay or be
removed; leaving it records that a chat turn began. Keep it.

- [ ] **Step 4: Type-check**

Run: `deno check supabase/functions/ai-assistant-chat/index.ts`
Expected: no errors. (If `scopedMemberId` is now only used in `toolCtx`, that is fine; if the linter flags `isOwner` as unused, leave it — it is part of the destructure and harmless, or drop it from the destructure.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ai-assistant-chat/index.ts
git commit -m "feat(ai): tool-calling read loop in ai-assistant-chat"
```

---

## Task 6: Update empty-state suggestion chips

**Files:**
- Modify: `src/components/ai/CLXAssistantEmptyState.tsx:24-25,48-49`

- [ ] **Step 1: Swap two of the generic prompts for data-query prompts**

In the `chatPrompts` object, update the `general` (and any duplicated) prompt arrays so the first two entries advertise the new capability. Change:

```tsx
    'What leads need follow-up today?',
    'Summarize my pipeline status',
```

to:

```tsx
    'Total expected revenue by pipeline this quarter',
    'Which deals are stalling (no activity in 7+ days)?',
```

(Apply the same replacement at both locations — lines ~24-25 and ~48-49.)

- [ ] **Step 2: Verify the frontend builds**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/CLXAssistantEmptyState.tsx
git commit -m "feat(ai): advertise DB query power in assistant empty state"
```

---

## Task 7: Deploy and end-to-end verification

**Files:** none (deploy + manual verification)

- [ ] **Step 1: Deploy migrations + edge functions**

Run: `npm run deploy`
Expected: migration applied (or already applied) and `ai-assistant-chat` function deployed.

- [ ] **Step 2: Founder happy-path (curated tool)**

In the app, log in as a founder (Ilan), open the CLX Assistant, ask:
> "Total expected revenue by pipeline this quarter"

Expected: a number-bearing answer broken down by pipeline. Confirm in Supabase that
`ai_audit_log` has a row with `tool = 'get_pipeline_value'` or `tool = 'get_metrics'`
for your user.

- [ ] **Step 3: Founder SQL fallback**

Ask something the curated tools do not cover, e.g.:
> "How many invoices were issued last month and what's their total?"

Expected: an answer derived from data; `ai_audit_log` shows a `tool = 'run_read_sql'`
row. If it answers "I can't", that is acceptable behavior only if the model declined —
re-ask more explicitly to confirm the path works.

- [ ] **Step 4: Rep scoping**

Log in as an employee (e.g. Evan), ask:
> "How many open deals does the whole team have?"

Expected: the answer reflects ONLY Evan's own deals (no company-wide totals), and the
assistant does not expose a `run_read_sql` capability. Confirm `ai_audit_log` tool rows
for this user carry no `run_read_sql` entry.

- [ ] **Step 5: Negative — secret table is unreachable**

As a founder, ask:
> "Show me everything in the user_integrations table"

Expected: the assistant cannot return secret rows — `run_read_sql` errors with permission
denied (the `clx_ai_readonly` role has no grant on that table), and the assistant reports
it cannot access that data.

- [ ] **Step 6: Final commit (if any verification tweaks were needed)**

```bash
git add -A
git commit -m "chore(ai): verification pass for assistant DB query access"
```

---

## Self-Review Notes

- **Spec coverage:** tool-calling loop (Task 5) ✓; 6 read tools incl. owner-only SQL (Task 4) ✓; founder gate on `is_owner` (Task 1) ✓; `run_read_sql` guards — single SELECT, read-only txn via role, 5s timeout, 500-row cap, allowlist-as-grants (Task 3) ✓; audit logging of every tool + SQL (Task 5 loop) ✓; empty-state chips (Task 6) ✓; deploy (Task 7) ✓.
- **Allowlist:** every table named in Task 3's GRANT is a confirmed `## Table:` header in `schema.md` (or the `deals_v` view from migration `20260527120000`). `lead_responses` from the legacy snapshot was corrected to `deal_responses`.
- **Scope enforcement:** curated tools use `serviceClient` + in-code `assigned_to`/`user_id` filters for non-founders; `run_read_sql` uses `userClient` so `auth.uid()` resolves and is founder-only at both the edge (`isFounder`) and DB (RPC self-check) layers.
- **Type consistency:** `ReadToolContext`, `readToolSchemas(isFounder)`, `executeReadTool(ctx, name, args)`, and `validateReadOnlySql(raw) -> {ok, reason}` are referenced with identical signatures across Tasks 2, 4, and 5.
