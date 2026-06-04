# CLX Assistant — Database Query Access (Design Spec)

**Date:** 2026-06-04
**Author:** Ilan + Kin
**Status:** Approved design, pending implementation plan

## Problem

The CLX Assistant chat (`/admin/assistant`) advertises "I have read access to your
data," but in reality it answers from a **static, pre-baked snapshot** assembled by
`buildChatContext()` on every message. That snapshot is:

- Scoped to a **single team member** (`assigned_to = you`).
- Hard-capped (50 deals, 30 tasks, 50 communications, etc.).
- Limited to ~8 hardcoded tables out of 69 in the public schema.

As a result, questions like "how many deals closed across all reps in Q1?" or
"total expected revenue by pipeline this month?" are **impossible to answer** — the
data was never in the dump, and the LLM can only do math on the partial slice it was
handed. We cannot fix this by dumping more data: the full DB will not fit the context
window and would be slow and expensive on every message.

## Goal

Let users ask the CLX Assistant arbitrary questions about the business's data and get
accurate answers, by giving the assistant the ability to **query the database live**
instead of reading a fixed snapshot.

## Approved Decisions

| Decision | Choice |
|---|---|
| Query approach | **Hybrid** — curated structured read tools for common questions + a guarded read-only SQL fallback for anything arbitrary |
| Access scope | **Owners full, reps self** — founders get company-wide reads; employees stay scoped to their own data, enforced server-side |
| Table scope | **Business subset** — an explicit allowlist of ~25–30 business tables; auth/system/audit/encrypted-secret tables are never reachable |

## Architecture

The CLX Assistant UI is unchanged. The engine behind `ai-assistant-chat` changes from
"pre-bake a snapshot into the prompt" to a **tool-calling read loop** (the same loop
pattern `ai-assistant-agent` already uses for writes, capped at ~5 iterations):

```
User question
   ↓
ai-assistant-chat (tool-calling loop)
   ↓ LLM selects a tool
   ├─ curated read tool ──→ parameterized, scoped query ──→ rows
   └─ run_read_sql (owner-only) ──→ guarded read-only SQL ──→ rows
   ↓ rows fed back to the model
LLM streams a natural-language answer
```

The static `buildChatContext()` snapshot is removed from the per-message prompt. A
small "starter context" (the user's name, role, today's date, and a one-paragraph
summary of available tools) replaces it so the model knows what it can reach. Deals/
tasks/etc. are fetched on demand via tools.

### Components

1. **`run_read_sql` Postgres RPC + read-only role** (DB migration)
   - A `SECURITY DEFINER` function callable only with a verified owner context.
   - Executes inside a `READ ONLY` transaction with `statement_timeout` (5s) and a
     hard row cap (500 rows).
   - Validates the statement is a **single `SELECT`** (no DML/DDL, no multiple
     statements, no `;`-chaining, no CTE-wrapped writes).
   - Enforces a **table allowlist** — the query may only reference allowlisted business
     tables. Anything else is rejected before execution.
   - Returns rows as JSON.

2. **`_shared/aiAgent/readTools.ts`** (new shared module)
   - Defines ~6 read-tool schemas + executors, mirroring the structure of the existing
     write-tool module `tools.ts`.
   - Curated tools take **structured filters**, not SQL, and build parameterized
     Supabase queries. Aggregations run in SQL/RPC so numbers are exact.

3. **`ai-assistant-chat/index.ts`** (rewrite the engine, keep the surface)
   - Replace the snapshot prompt with the tool-calling loop.
   - Role-gate which tools are exposed (see Security).
   - Keep streaming the final natural-language answer to the client.

4. **Audit logging** — every tool call and every executed SQL statement is logged to
   `ai_audit_log` via the existing `logAiAudit` helper, including the generated SQL.

5. **Empty-state suggestion chips** — update `CLXAssistantEmptyState` to advertise the
   new capability (e.g. "Total revenue by rep this quarter", "Which deals are
   stalling?").

### Read tools

| Tool | Purpose | Scope behavior |
|---|---|---|
| `query_deals` | Filter deals by pipeline / status / outcome / value / rep / date | reps: self; owners: all |
| `get_metrics` | Aggregations & rollups (counts, sums, by-rep, by-pipeline, by-period) | reps: self; owners: all |
| `search_communications` | Find calls/emails/transcripts by lead, type, date, keyword | reps: self; owners: all |
| `lookup_lead` | 360° on one lead (deal + tasks + comms + questionnaire + files) | reps: self; owners: all |
| `query_tasks` | Tasks by status / priority / due / assignee | reps: self; owners: all |
| `run_read_sql` | **Owner-only** guarded read-only SQL fallback for anything uncovered | owners only |

## Security Model

Enforced **server-side**; the client cannot influence scope or role.

### 1. Authoritative owner gate (must fix an existing discrepancy)

The current edge helper derives `isOwner = app_role === 'admin' || 'super_admin'`
(`_shared/auth.ts`). But employees can hold `app_role = 'admin'`, which would wrongly
grant them founder-level company-wide reads — including the raw-SQL fallback.

The `users` table has an authoritative `is_owner` boolean column (used by the frontend
as `is_owner || app_role === 'super_admin'`). **This feature gates company-wide reads
and the SQL fallback on `users.is_owner === true` (or `app_role === 'super_admin'`),
NOT on the loose `app_role === 'admin'` check.** A dedicated `isFounder` determination
is introduced for this purpose so we do not silently widen the meaning of the existing
`isOwner` used elsewhere.

- **Founders** (`is_owner`/`super_admin`): all 6 tools, unscoped (company-wide).
- **Reps** (everyone else, incl. `app_role = 'admin'`): the 5 curated tools only,
  auto-scoped to `assigned_to = self`. **No raw SQL.**

Because the SQL fallback is founder-only, we do not need to inject per-rep scope
predicates into arbitrary SQL — founders see everything by design, which removes the
hardest safety problem.

### 2. `run_read_sql` lockdown

Single `SELECT` only · `READ ONLY` transaction · `statement_timeout` 5s · 500-row cap ·
table allowlist checked before execution · founder-only invocation.

### 3. Allowlist, not blocklist

The ~25–30 business tables are explicitly named (deals/`deals_v`, leads,
`lead_responses`, tasks, communications, appointments, email_threads, invoices,
partner_referrals, lender programs, dropbox_files, etc.). Never reachable — even by
founders, even via the SQL fallback:

- `user_integrations` and any encrypted-secret tables
- `ai_audit_log`
- rate-limit counters
- auth internals

The final allowlist is enumerated during implementation against `schema.md`.

### 4. Full audit trail

Every read tool call and every executed SQL statement is logged to `ai_audit_log`
(actor, tool, scope, generated SQL, success/failure).

## Out of Scope

- No frontend chat-UI rewrite (surface is unchanged).
- No new write capabilities (writes remain in `ai-assistant-agent`).
- No changes to per-rep RLS policies on the underlying tables (founder-only SQL
  sidesteps the need).
- No natural-language-to-chart / visualization rendering.

## Implementation Order

1. DB migration: read-only role + `run_read_sql` RPC (guards + table allowlist).
2. `_shared/aiAgent/readTools.ts` — 6 tool schemas + executors, with founder/rep
   scoping.
3. Introduce the `isFounder` gate (`is_owner`/`super_admin`) for read access.
4. Rewrite `ai-assistant-chat` engine to the tool-calling loop; keep streaming.
5. Wire audit logging for reads.
6. Update empty-state suggestion chips.
7. `npm run deploy` (migrations + edge functions).

## Success Criteria

- A founder can ask "total expected revenue by rep this quarter" and get an accurate,
  database-derived number.
- A founder can ask an arbitrary question not covered by curated tools and get an
  answer via the SQL fallback.
- A rep asking the same company-wide question only ever sees their own data.
- No user (founder or rep) can read encrypted-secret, audit, or auth tables.
- Every read is present in `ai_audit_log`.
