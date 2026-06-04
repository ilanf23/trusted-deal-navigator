# Add Vercel AI SDK — Replace Raw LLM `fetch()` Calls (REVISED)

> **Supersedes** `docs/plans/2026-05-21-vercel-ai-sdk-migration.md`, which was written against an
> earlier state of the codebase and is now factually wrong in several places (see
> "Corrections vs. the original plan" below). Use **this** doc.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the Vercel AI SDK (`ai` package) inside the Supabase Edge Functions and replace the
hand-rolled OpenAI-compatible `fetch()` + SSE machinery with `streamText` / `generateText`. The win
we are actually buying is **developer experience**: ~150 lines of duplicated SSE parsing deleted,
Zod-typed tool definitions, and a uniform streaming abstraction.

**Goal we are NOT buying:** "multi-provider support." We already have that — see below.

---

## Read this first: the premise of ticket #98 is out of date

The ticket and the original plan both assert:

- *"Replace raw `fetch()` calls to the OpenAI API"*
- *"Provider is hardcoded to OpenAI `gpt-4o-mini`"*

**Neither is true today.** The current code already:

- Routes every chat/agent call through a single switch module, `supabase/functions/_shared/llmConfig.ts`.
- Uses **OpenRouter** (`LLM_PROVIDER = "openrouter"`), model **`google/gemma-4-31b-it`**, over the
  OpenAI-compatible wire format.
- Resolves per-user keys via `getProviderKey(serviceClient, memberId, LLM_PROVIDER, LLM_API_KEY_ENV)`,
  with a Supabase-secret fallback (`OPENROUTER_API_KEY`).

OpenRouter is itself a multi-provider gateway, so **switching models/providers is already a one-line
change in `llmConfig.ts`.** That means the headline "multi-provider" benefit is mostly already
solved. Frame this ticket honestly as a **refactor for DX + Zod tools**, not a capability unlock.

> **Decision required before starting:** Is this refactor worth touching three live, untested AI
> surfaces just to delete SSE boilerplate? If yes, proceed. If the team would rather wait until
> there's test coverage or a concrete provider-switching need, defer. Don't run it on the false
> premise in the original ticket.

---

## Corrections vs. the original plan

| Original plan said | Reality in the code | Consequence |
|---|---|---|
| "Replace raw `fetch()` to the OpenAI API" | Calls go to OpenRouter via `llmConfig.ts` constants | The new `provider.ts` must **build on `llmConfig.ts`, not replace it** |
| "Provider hardcoded to OpenAI `gpt-4o-mini`" | OpenRouter + `google/gemma-4-31b-it` | Plan's `DEFAULT_MODEL = 'openai:gpt-4o-mini'` would **silently regress the model** |
| `ai-assistant-chat` is a simple ~35-line stream pipe | It runs a **5-iteration read-tool loop** (`readToolSchemas` / `executeReadTool`) *then* streams | Plan's `streamText({model, system, messages})` **drops the read tools** → chat/assist stop fetching live data and start hallucinating numbers |
| Only `tools.ts` (write tools) needs Zod conversion | There is a **second tool set** in `readTools.ts` used by chat/assist | Must convert **both** files, or scope readTools out explicitly |
| "6 tools" in `tools.ts` | **5** write tools | Cosmetic, but indicates the plan wasn't checked against the file |
| Undo/redo lives in `ai_agent_changes` / `ai_agent_batches` | Consolidated into **`ai_events`** (branch `feat/ai-events-consolidation`); agent already inserts `event_type: "agent_batch"` into `ai_events` | "Stays unchanged" section references retired tables; re-verify against `ai_events` |
| Chat returns OpenAI SSE the frontend parses | ✅ Correct (`ai-assistant-chat/index.ts:202` pipes `text/event-stream`) | Frontend change in Phase 2 still valid |

---

## Current-state inventory (verified 2026-06-04)

### `supabase/functions/_shared/llmConfig.ts`
Single source of truth for provider/model/key/headers. **Keep this as the foundation.**
- `LLM_PROVIDER = "openrouter"`, `LLM_API_KEY_ENV = "OPENROUTER_API_KEY"`
- `LLM_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"`
- `LLM_MODEL = "google/gemma-4-31b-it"`
- `llmHeaders(apiKey)` adds OpenRouter attribution headers.

### `ai-assistant-chat/index.ts` (chat + assist modes)
- **Phase 1 (lines ~139–178):** up to 5 iterations of `fetch(LLM_CHAT_ENDPOINT, { tools, tool_choice: "auto" })`,
  executing **read tools** via `executeReadTool` and pushing `role: "tool"` results back into `convo`.
  Tools come from `readToolSchemas(isFounder)`.
- **Phase 2 (lines ~180–204):** a final `fetch(..., { tool_choice: "none", stream: true })` whose
  `response.body` is piped straight to the client as `text/event-stream` (raw OpenAI SSE).
- System prompt **explicitly requires** tool use: *"You do NOT have the data… you MUST call the
  provided read tools to fetch live data first."*

### `ai-assistant-agent/index.ts` (agent mode)
- Builds context (`deals_v`, `tasks`), inserts an `agent_batch` row into **`ai_events`**.
- Hand-rolled `ReadableStream` emitting custom SSE events: `text`, `tool_start`, `tool_result`,
  and a terminal `data: [DONE]`.
- Manual loop (≤5 iterations): `fetch(..., { tools: agentTools })` → on `tool_calls`, runs
  `executeAction(...)` (which logs to `ai_events`) → feeds results back.

### `_shared/aiAgent/tools.ts` — 5 **write** tools (raw JSON schema)
`update_lead`, `create_task`, `complete_task`, `log_activity`, `bulk_update_leads`.

### `_shared/aiAgent/readTools.ts` — 6 **read** tool schemas
`query_deals`, `get_metrics`, `search_communications`, `lookup_lead`, `query_tasks`,
`run_read_sql` (**founder-only**, runs via the user client / caller JWT).

### `src/components/ai/CLXAssistant.tsx`
Three handlers (`handleChatSubmit`, `handleAssistSubmit`, `handleAgentSubmit`) each hand-parse SSE
buffers. Chat/assist parse the OpenAI delta SSE; agent parses the custom event SSE above.

---

## Files involved

| File | Change |
|---|---|
| `supabase/functions/ai-sdk-spike/index.ts` | **New, throwaway** — Phase 0 only, deleted after |
| `supabase/functions/_shared/aiAgent/provider.ts` | **New** — registry that **reads from `llmConfig.ts`** |
| `supabase/functions/_shared/llmConfig.ts` | Possibly extend (add structured model id), do **not** duplicate |
| `supabase/functions/ai-assistant-chat/index.ts` | `streamText` **with read tools + `maxSteps`** |
| `supabase/functions/ai-assistant-agent/index.ts` | `streamText` with `agentTools` + step callbacks; keep custom SSE + `ai_events` logging |
| `supabase/functions/_shared/aiAgent/tools.ts` | Convert 5 write tools to `tool()` + Zod |
| `supabase/functions/_shared/aiAgent/readTools.ts` | Convert 6 read tool schemas to `tool()` + Zod (or scope out explicitly) |
| `src/components/ai/CLXAssistant.tsx` | Simplify chat/assist stream reading; keep agent event parsing |

**Out of scope (unchanged):** `ai-assistant-actions` (no LLM calls), `executor.ts` execute/undo/redo,
`ai_events` schema, rate limiting, `<action>` XML tag parsing (`useActionParser`), prompt content.

---

## Phase 0 — Deno compatibility spike (BLOCKER) — ✅ DONE, PASSED (2026-06-04)

Verified empirically by deploying a throwaway `ai-sdk-spike` edge function to the live project
(`kpgrogjmvjauusdnnrln`) and curling it. **The Vercel AI SDK runs in Supabase Edge/Deno.**

Evidence:
- `streamText().toTextStreamResponse()` → returned `Hello!` as plain text. ✅ Streaming works.
- `generateText()` + Zod `tool()` (forced) → `input: {"expression":"48273 * 9182"}`,
  `output.result: "443242686"` (matches local compute). ✅ Tool-calling + execution work end-to-end.

### Findings that CHANGE the rest of this plan (both plans' code samples were AI SDK v4)
- **`npm:ai` floats to v6.0.196.** → **Pin `npm:ai@6`** (and matching `@ai-sdk/*`) in every import,
  or future deploys silently break on a new major.
- **`tool({ parameters })` → `tool({ inputSchema })`.** The first spike returned empty tool args
  (`input: {}`) until switched to `inputSchema`. **All tool conversions below use `inputSchema`.**
- **`maxSteps: n` → `stopWhen: stepCountIs(n)`** (import `stepCountIs` from `npm:ai@6`). The
  5-iteration loops migrate to `stopWhen`.
- **`toolChoice: "required"` forces a tool call on every step** (caused a redundant 2nd call in the
  spike). Use the default `"auto"` for the read/agent loops.

### Cleanup note
- Local spike dir deleted. The **remote `ai-sdk-spike` function is still deployed** (Supabase MCP has
  no delete-function tool) — remove it via dashboard or `supabase functions delete ai-sdk-spike`.

### Decision gate → PASSED. Proceed to Phase 1.

---

## Execution status (2026-06-04)

- ✅ **Task 1.1 provider.ts** — created (lazy-loads optional providers; default seeded from llmConfig).
- ✅ **Task 1.2 readTools.ts** — `buildReadSdkTools()` added (Zod `inputSchema`); `executeReadTool`
  kept intact. (Write tools in `tools.ts` deferred to the agent slice.)
- ✅ **Task 1.3 ai-assistant-chat** — migrated to `streamText` + `stopWhen(5)`; **deployed and
  verified live** against project `kpgrogjmvjauusdnnrln`:
  - Chat: `get_metrics` returned 60 open deals / $416.3M — **exact DB match**, not hallucinated.
  - Assist: emitted valid `<action>` tags with real deal UUIDs.
  - Founder gate: `run_read_sql` worked for founder; non-founder (Evan) correctly lacked the tool.
  - Rep scoping: founder saw 60 open deals, Evan scoped to his own (0, DB-confirmed).
- ✅ **Task 1.4 ai-assistant-agent** — migrated to `streamText` + `stopWhen(5)`; custom SSE protocol
  and `executeAction`/`ai_events` logging preserved. **Deployed and verified live:** create_task
  produced a real task (count 478→479), an `agent_batch` + `agent_change` (parent_id=batch) +
  `audit` row in `ai_events` (undo/redo chain intact), and the SSE frames were byte-identical to the
  old protocol. Test artifacts cleaned up.
- ✅ **Task 1.2 tools.ts** — write tools converted to Zod `tool()` via `buildAgentSdkTools(runner)`.
- ✅ **Phase 2 frontend** — `CLXAssistant.tsx` (the **only** streaming consumer in the app) switched
  from OpenAI-SSE parsing to plain-text reading. No assist/agent streaming UI exists yet, so nothing
  else needed changing. Change is tsc/eslint-clean on the edited lines.
- ⬜ **Phase 3 (optional client model param)** — deferred. `resolveModel(modelId, keys)` already
  accepts a model id; wiring an optional `body.model` override is a small follow-up when a picker is
  built. Default path unchanged.

### Reality corrections found during execution (plan vs. code)
- Frontend had **one** streaming handler (chat-only `CLXAssistant.tsx`), not "3 handlers / ~150
  lines". No `useActionParser`/`<action>`-tag parser exists. `useAIChanges.ts` does no streaming.
- `run_read_sql` runs via the **user client under RLS**, so a founder's count can differ from a
  service-role count (observed 200 vs 478 tasks) — expected, not a regression.

### Frontend not yet deployed
The Vite SPA deploys separately from edge functions. The chat backend (plain text) is live now, so the
**app's chat UI needs this frontend change shipped** to render correctly. Verify by running the app.

---

## Phase 1 — Backend migration

### Task 1.1 — Provider registry that extends `llmConfig.ts` (do NOT duplicate it)
**File:** create `supabase/functions/_shared/aiAgent/provider.ts`

- [ ] Build a registry seeded from the existing config so the default stays OpenRouter +
      `google/gemma-4-31b-it`. Sketch:

```ts
// provider.ts
import { createProviderRegistry } from "npm:ai";
import { createOpenRouter } from "npm:@openrouter/ai-sdk-provider";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { createAnthropic } from "npm:@ai-sdk/anthropic";
import { LLM_MODEL } from "../llmConfig.ts"; // reuse the single switch

// DEFAULT_MODEL must match llmConfig.ts, NOT 'openai:gpt-4o-mini'.
export const DEFAULT_MODEL = `openrouter:${LLM_MODEL}`; // 'openrouter:google/gemma-4-31b-it'

export function createRegistry(keys: {
  openrouterKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
}) {
  const providers: Record<string, any> = {};
  if (keys.openrouterKey) providers.openrouter = createOpenRouter({ apiKey: keys.openrouterKey });
  if (keys.openaiKey)     providers.openai     = createOpenAI({ apiKey: keys.openaiKey });
  if (keys.anthropicKey)  providers.anthropic  = createAnthropic({ apiKey: keys.anthropicKey });
  return createProviderRegistry(providers);
}
```

- [ ] Keep `getProviderKey()` as the key resolver. For now only OpenRouter is required; the others
      are opt-in (register only if a key exists).

### Task 1.2 — Convert tool definitions to Zod
**Files:** `_shared/aiAgent/tools.ts` (5 write tools), `_shared/aiAgent/readTools.ts` (6 read tools)

- [ ] Convert each raw JSON schema to `tool({ description, inputSchema: z.object({...}) })`
      (**`inputSchema`, not `parameters`** — see Phase 0 findings).
- [ ] For `readTools.ts`, keep `executeReadTool()` **as-is** (it holds the rep-scoping/founder
      security logic). Add a builder that returns SDK tools whose `execute` delegates to
      `executeReadTool(ctx, name, args)`, built inside the handler so it can close over `ctx` +
      audit logging. Keep arg names **snake_case** to match existing executors.
- [ ] **Do NOT add `execute` to the write tools** — the agent runs them through `executeAction()` so
      it can log to `ai_events` for undo/redo. (Read tools *may* use `execute`, since their results
      just feed back into the model and `executeReadTool` is side-effect-free — decide per file.)
- [ ] Preserve enums (`priority`, `activity_type`) and the **founder-only gate** on `run_read_sql`
      (keep the `isFounder` check; `readToolSchemas(isFounder)` currently omits it for non-founders —
      keep that conditional inclusion).
- [ ] Convert `bulk_update_leads.lead_ids` to `z.array(z.string())`.

### Task 1.3 — Migrate `ai-assistant-chat` (chat + assist)
**File:** `ai-assistant-chat/index.ts`

- [ ] Replace **both** the Phase-1 read-tool loop and the Phase-2 stream `fetch` with a **single**
      `streamText` that keeps the tools:

```ts
const registry = createRegistry({ openrouterKey: LLM_API_KEY });
const result = streamText({
  model: registry.languageModel(modelId),     // modelId defaults to DEFAULT_MODEL
  system: systemPrompt,
  messages,                                    // client turns (system handled above)
  tools: readTools,                            // Zod read tools — REQUIRED, do not drop
  maxSteps: 5,                                 // preserves the 5-iteration tool budget
});
return result.toTextStreamResponse({ headers: corsHeaders });
```

- [ ] Keep `logAiAudit` for each tool call — wire it via `onStepFinish` / tool `execute` so the audit
      trail (`read_context` + per-tool rows) is preserved.
- [ ] Preserve the security-critical scoping: `ReadToolContext.memberId` must stay pinned to
      `teamMember?.id` (never the client-supplied `requestedMemberId`) — see the existing comment at
      `index.ts:125`.
- [ ] Assist mode: no special handling — the `<action>` tags are plain text the model emits; they
      survive `toTextStreamResponse()` untouched.

### Task 1.4 — Migrate `ai-assistant-agent` (HIGHEST RISK — see notes)
**File:** `ai-assistant-agent/index.ts`

- [ ] Use `streamText` with `stopWhen: stepCountIs(5)`. Because the agent must emit its **custom SSE
      protocol** and run writes through `executeAction()`, give each agent tool an `execute` that
      closes over the SSE `send()` helper + context: emit `tool_start` → map snake_case args to the
      camelCase `actionParams` the current code builds → `executeAction(...)` (logs to `ai_events`)
      → emit `tool_result` → return the result so the SDK loop continues. Stream assistant text via
      `result.fullStream` as `{ type: "text" }` events.
- [ ] Keep the existing `ReadableStream` + `send()` wrapper and the exact event names
      (`text`, `tool_start`, `tool_result`, `batch_complete`, `[DONE]`) so **`handleAgentSubmit` in
      the frontend needs no changes**. Verify whether the frontend appends or replaces on `text`
      before switching from one final message to streamed deltas.
- [ ] Leave the `agent_batch` insert and all `ai_events` writes exactly as they are.

> **Pre-existing constraint (not ours to fix):** `executeAction()` currently **stubs**
> `update_lead`, `bulk_update_leads`, `log_activity` (returns `success:false`, "must be rewritten
> against the deals_v model"). Only `create_task` / `complete_task` mutate. The migration preserves
> this behavior verbatim — do not attempt to re-implement those actions here.

---

## Phase 2 — Frontend

**File:** `src/components/ai/CLXAssistant.tsx`

- [ ] `handleChatSubmit` / `handleAssistSubmit`: replace OpenAI-delta SSE parsing with plain text
      reading of the `toTextStreamResponse()` body (read chunks, append, `setStreamingContent`).
      Removes ~100 lines.
- [ ] `handleAgentSubmit`: **keep** SSE event parsing — the agent still emits the custom
      `tool_start` / `tool_result` / `[DONE]` events (Task 1.4). Only verify the text frames still
      decode.
- [ ] `useActionParser` (assist `<action>` tags): unchanged — operates on final text.

---

## Phase 3 — Optional client-selectable model

- [ ] Accept an optional `model` field in the request body; fall back to `DEFAULT_MODEL`.
- [ ] If the requested model's provider has no configured key, return a clear `400`
      (`No API key configured for provider 'anthropic'`).
- [ ] This unlocks a future model picker with no further backend changes. Low priority — defer
      unless there's a concrete need, since OpenRouter already exposes many models under one key.

---

## Deployment

After all phases: the developer (not Claude) runs `npm run deploy` (migrations + edge functions).

---

## Verification checklist (manual — no automated tests in this repo)

- [ ] **Chat mode** — message streams; **a data question (e.g. "how many open deals?") still hits a
      read tool and returns real numbers** (regression guard for the dropped-tools bug).
- [ ] **Assist mode** — `<action>` tags render and are confirmable.
- [ ] **Agent mode** — `tool_start` / `tool_result` events stream live; a write executes; **undo
      works and `ai_events` rows are written**.
- [ ] **Founder gate** — `run_read_sql` available to founders only.
- [ ] **Scoping** — a non-founder employee-admin cannot read another rep's data.
- [ ] **Default model unchanged** — confirm calls still resolve to
      `openrouter:google/gemma-4-31b-it`, not gpt-4o-mini.
- [ ] **Rate limiting** — still enforced (unchanged).

---

## Summary of changes

| What | Before | After |
|---|---|---|
| LLM transport | Hand-rolled `fetch()` to OpenRouter (OpenAI-compatible) | `streamText` via Vercel AI SDK |
| Provider/model | OpenRouter `google/gemma-4-31b-it` via `llmConfig.ts` | **Same default**, now through an SDK registry seeded from `llmConfig.ts` |
| Chat/assist read tools | 6 raw-JSON read tools in a manual loop | Same 6 tools as Zod via `tool()`, `maxSteps` |
| Agent write tools | 5 raw-JSON tools, manual `executeAction` loop | Same 5 as Zod; execution still via `executeAction` |
| Agent SSE events | Custom `ReadableStream` | Kept, driven by SDK step callbacks |
| Frontend SSE | ~150 lines manual parsing (×3) | Plain text read for chat/assist; event parsing kept for agent |
| Undo/redo + `ai_events` | Unchanged | Unchanged |
| Multi-provider | Already available via OpenRouter | Same, plus optional native OpenAI/Anthropic registration |
