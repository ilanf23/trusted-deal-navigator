# Add Vercel AI SDK — Replace Raw OpenAI Calls

> ⚠️ **OUTDATED — DO NOT IMPLEMENT.** This plan was written against an earlier codebase state and is
> wrong about the current code (the system is already on OpenRouter via `llmConfig.ts`, not raw
> OpenAI; chat already runs a read-tool loop; undo/redo is on `ai_events`). Use the corrected plan:
> **`docs/plans/2026-06-04-vercel-ai-sdk-migration-revised.md`**.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Vercel AI SDK (`ai` package) to the Supabase Edge Functions. Replace all raw `fetch()` calls to the OpenAI API with the SDK's `streamText` / `generateText` helpers. This gives us a single abstraction for streaming, tool calling, and provider switching — so we can use Anthropic, OpenAI, or OpenRouter without changing function logic.

**Current state:** Three edge functions (`ai-assistant-chat`, `ai-assistant-agent`, `ai-assistant-actions`) call the OpenAI API directly with `fetch()`. SSE responses are parsed manually on both backend (agent mode) and frontend (all 3 modes in `CLXAssistant.tsx`). Tool definitions in `_shared/aiAgent/tools.ts` use raw JSON schema. Provider is hardcoded to OpenAI `gpt-4o-mini`.

**Tech Stack:** Deno edge functions (Supabase), Vercel AI SDK (`ai`), provider packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@openrouter/ai-sdk-provider`). **No automated tests in this repo** — verification is done via manual smoke tests and curl checks.

**Out of scope:** Changing the AI prompt content, modifying the undo/redo system, adding a UI for provider selection (that's a separate ticket), changing rate limits.

---

## Background

### Why Vercel AI SDK?

1. **Multi-provider support** — Switch between OpenAI, Anthropic, and OpenRouter with one config change. The SDK handles each provider's API format differences.
2. **Less code** — `streamText()` replaces ~50 lines of manual SSE buffering per call site. Tool definitions use Zod schemas instead of raw JSON.
3. **Standard response format** — The SDK returns a unified stream format. The frontend can use `useChat()` or parse a simple text stream instead of hand-parsing `data: {"choices":[{"delta":{"content":"..."}}]}`.
4. **Active maintenance** — Vercel AI SDK is the most popular LLM SDK in the JS/TS ecosystem. Provider packages are kept up to date.

### Key Risk: Deno Compatibility

Vercel AI SDK is built for Node.js. It _should_ work in Deno with `npm:` specifiers (e.g., `import { streamText } from "npm:ai"`), but this is **not confirmed**. Phase 0 exists to verify this before any other work begins.

---

## Files Involved

### Edge functions to modify

| File | What changes |
|---|---|
| `supabase/functions/ai-assistant-chat/index.ts` | Replace raw `fetch()` + SSE stream with `streamText()` |
| `supabase/functions/ai-assistant-agent/index.ts` | Replace raw `fetch()` loop + tool parsing with `generateText()` + SDK tool calling |
| `supabase/functions/ai-assistant-actions/index.ts` | No LLM calls — **no changes needed** |

### Shared modules to modify/create

| File | What changes |
|---|---|
| `supabase/functions/_shared/aiAgent/tools.ts` | Convert 6 raw JSON tool definitions to Vercel AI SDK `tool()` + Zod |
| `supabase/functions/_shared/aiAgent/provider.ts` | **New file** — provider registry setup and model resolver |

### Frontend files to modify

| File | What changes |
|---|---|
| `src/components/ai/CLXAssistant.tsx` | Simplify SSE parsing in `handleChatSubmit`, `handleAssistSubmit`, `handleAgentSubmit` (~150 lines of duplicated buffer logic) |

### Config files

| File | What changes |
|---|---|
| `supabase/functions/import_map.json` (if used) or individual imports | Add `npm:ai`, `npm:@ai-sdk/openai`, `npm:zod` specifiers |

---

## Phase 0: Spike — Deno Compatibility (do this first, block everything else)

**Goal:** Confirm Vercel AI SDK works in a Supabase Edge Function before writing any migration code.

### Task 0.1: Create a throwaway test function

**Files:**
- Create: `supabase/functions/ai-sdk-spike/index.ts`

- [ ] **Step 1: Create a minimal edge function that imports the AI SDK**

```ts
import { streamText } from "npm:ai";
import { createOpenAI } from "npm:@ai-sdk/openai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const openai = createOpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY')!,
  });

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
  });

  return result.toTextStreamResponse();
});
```

- [ ] **Step 2: Deploy and test**

Tell the developer to run `npx supabase functions deploy ai-sdk-spike` and then curl it:

```bash
curl -N -H "Authorization: Bearer <anon-key>" \
  https://<project>.supabase.co/functions/v1/ai-sdk-spike
```

- [ ] **Step 3: Test tool calling**

Extend the spike to include a simple `tool()` definition with Zod:

```ts
import { generateText, tool } from "npm:ai";
import { z } from "npm:zod";

// ... inside handler:
const result = await generateText({
  model: openai('gpt-4o-mini'),
  messages: [{ role: 'user', content: 'What is 2+2?' }],
  tools: {
    calculate: tool({
      description: 'Calculate a math expression',
      parameters: z.object({ expression: z.string() }),
      execute: async ({ expression }) => String(eval(expression)),
    }),
  },
});
```

- [ ] **Step 4: Test Anthropic provider**

```ts
import { createAnthropic } from "npm:@ai-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
});
```

- [ ] **Step 5: Delete spike function**

Remove `supabase/functions/ai-sdk-spike/` after all tests pass.

### Decision gate

If the spike **fails** (import errors, runtime crashes, missing APIs), stop here. Options:
- Use an npm-to-Deno build step (esbuild)
- Wait for Deno compatibility improvements
- Build a thin wrapper that calls `streamText`-like helpers manually

If the spike **passes**, continue to Phase 1.

---

## Phase 1: Backend — Provider Registry + streamText Migration

### Task 1.1: Create provider registry module

**Files:**
- Create: `supabase/functions/_shared/aiAgent/provider.ts`

- [ ] **Step 1: Create the provider registry**

```ts
// supabase/functions/_shared/aiAgent/provider.ts
import { createProviderRegistry } from "npm:ai";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { createAnthropic } from "npm:@ai-sdk/anthropic";
import { createOpenRouter } from "npm:@openrouter/ai-sdk-provider";

export function createRegistry(keys: {
  openaiKey?: string;
  anthropicKey?: string;
  openrouterKey?: string;
}) {
  const providers: Record<string, any> = {};

  if (keys.openaiKey) {
    providers.openai = createOpenAI({ apiKey: keys.openaiKey });
  }
  if (keys.anthropicKey) {
    providers.anthropic = createAnthropic({ apiKey: keys.anthropicKey });
  }
  if (keys.openrouterKey) {
    providers.openrouter = createOpenRouter({ apiKey: keys.openrouterKey });
  }

  return createProviderRegistry(providers);
}

// Default model used across all AI functions.
// Change this one line to switch the model globally.
export const DEFAULT_MODEL = 'openai:gpt-4o-mini';
```

- [ ] **Step 2: Update `getProviderKey` usage pattern**

The existing `getProviderKey(supabase, userId, 'openai', 'OPENAI_API_KEY')` pattern stays. For multi-provider, call it once per provider that's configured. The registry only registers providers that have a valid key.

---

### Task 1.2: Migrate `ai-assistant-chat` to `streamText`

**Files:**
- Modify: `supabase/functions/ai-assistant-chat/index.ts`

- [ ] **Step 1: Replace imports**

Remove the raw `fetch()` call to `https://api.openai.com/v1/chat/completions`. Add:

```ts
import { streamText } from "npm:ai";
import { createRegistry, DEFAULT_MODEL } from "../_shared/aiAgent/provider.ts";
```

- [ ] **Step 2: Replace the streaming logic**

Current code (approximately lines 55-90) builds a fetch request to OpenAI and pipes the response. Replace with:

```ts
const registry = createRegistry({ openaiKey: OPENAI_API_KEY });

const result = streamText({
  model: registry.languageModel(DEFAULT_MODEL),
  system: systemPrompt,
  messages: conversationMessages,
});

return result.toTextStreamResponse({
  headers: corsHeaders,
});
```

This replaces ~35 lines of manual stream handling with 6 lines.

- [ ] **Step 3: Verify response format**

The SDK's `toTextStreamResponse()` returns plain text chunks (not the OpenAI SSE format). The frontend parser in `CLXAssistant.tsx` will need to change (Phase 2). For now, verify the edge function returns a valid streaming response.

**Important:** The `assist` mode also runs through this function. The assist mode system prompt includes instructions to output `<action>` XML tags. These tags are model-agnostic — they work with any provider, not just OpenAI. No prompt changes needed.

---

### Task 1.3: Migrate `ai-assistant-agent` to `generateText` with tools

**Files:**
- Modify: `supabase/functions/ai-assistant-agent/index.ts`
- Modify: `supabase/functions/_shared/aiAgent/tools.ts`

- [ ] **Step 1: Convert tool definitions to Zod schemas**

Current format in `tools.ts` (6 tools, raw JSON schema):

```ts
export const agentTools = [
  {
    type: "function",
    function: {
      name: "update_lead",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID of the lead" },
          field: { type: "string", description: "Field name to update" },
          new_value: { type: "string", description: "New value" },
        },
        required: ["lead_id", "field", "new_value"],
      },
    },
  },
  // ... 5 more tools
];
```

New format:

```ts
import { tool } from "npm:ai";
import { z } from "npm:zod";

export const agentTools = {
  update_lead: tool({
    description: "Update a field on a lead record",
    parameters: z.object({
      lead_id: z.string().describe("UUID of the lead"),
      field: z.string().describe("Field name to update"),
      new_value: z.string().describe("New value for the field"),
    }),
  }),
  create_task: tool({
    description: "Create a new task",
    parameters: z.object({
      title: z.string(),
      description: z.string().optional(),
      lead_id: z.string().optional().describe("UUID of the related lead"),
      due_date: z.string().optional().describe("ISO date string"),
      assignee_id: z.string().optional().describe("UUID of team member"),
    }),
  }),
  // ... convert all 6 tools
};
```

**Note:** Do NOT add `execute` functions to the tool definitions. The agent function handles execution separately via `executeAction()` because it needs to log changes to `ai_agent_changes` for undo/redo.

- [ ] **Step 2: Replace the agent loop in `ai-assistant-agent/index.ts`**

Current code runs a manual loop (up to 5 iterations): calls OpenAI, checks for `tool_calls` in the response, runs `executeAction()`, sends results back. Replace with:

```ts
import { generateText } from "npm:ai";
import { createRegistry, DEFAULT_MODEL } from "../_shared/aiAgent/provider.ts";
import { agentTools } from "../_shared/aiAgent/tools.ts";

const result = await generateText({
  model: registry.languageModel(DEFAULT_MODEL),
  system: systemPrompt,
  messages: conversationMessages,
  tools: agentTools,
  maxSteps: 5,
  onStepFinish: async ({ toolCalls, toolResults }) => {
    // Stream SSE log events to the client (tool_start, tool_result)
    // Execute via executeAction() and log to ai_agent_changes
  },
});
```

**Important:** The current agent streams SSE events (`tool_start`, `tool_result`, `thinking`, `batch_complete`) to the client as tools execute. The `generateText` function does not stream by default. You have two options:

**Option A (simpler):** Use `generateText` with `maxSteps`, then send all results at the end. This changes the UX — user sees results all at once instead of incrementally.

**Option B (keeps current UX):** Use `streamText` with `maxSteps` and `onChunk` callback to emit SSE events as tools execute. This keeps the progressive UI but is more complex.

Recommend **Option B** to keep the current UX where users see tools executing in real time.

- [ ] **Step 3: Keep the `ai_agent_changes` logging intact**

The `executeAction()` and `undoChange()` / `redoChange()` functions in `_shared/aiAgent/executor.ts` do NOT change. They don't call the LLM — they run Supabase queries and log mutations. Keep them exactly as-is.

- [ ] **Step 4: Keep `ai-assistant-actions` unchanged**

The `ai-assistant-actions` edge function handles `execute`, `undo`, `redo`, `undo_batch`. It never calls the LLM. No changes needed for this function.

---

## Phase 2: Frontend — Simplify SSE Parsing

### Task 2.1: Update `CLXAssistant.tsx` stream handling

**Files:**
- Modify: `src/components/ai/CLXAssistant.tsx`

- [ ] **Step 1: Understand the current parsing**

All 3 handlers (`handleChatSubmit`, `handleAssistSubmit`, `handleAgentSubmit`) have ~50 lines each of identical SSE buffer parsing:

```ts
// Current pattern (repeated 3 times):
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = JSON.parse(line.slice(6));
      const content = json.choices?.[0]?.delta?.content;
      // ...
    }
  }
}
```

- [ ] **Step 2: Replace with plain text stream reading**

After the backend migration, `streamText().toTextStreamResponse()` returns plain text chunks (not SSE). The parsing becomes:

```ts
const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullText = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  fullText += chunk;
  setStreamingContent(fullText);
}
```

This removes ~100 lines of duplicated SSE parsing across the 3 handlers.

- [ ] **Step 3: Agent mode — keep SSE parsing for tool events**

The agent handler (`handleAgentSubmit`) parses SSE events for tool execution progress (`tool_start`, `tool_result`, `batch_complete`). If you keep this SSE format from the backend (Phase 1, Task 1.3 Option B), the agent handler still needs SSE parsing — but only for the structured tool events, not for the LLM text stream.

- [ ] **Step 4: Assist mode — no changes to action parsing**

The `useActionParser` hook parses `<action>` XML tags from the response text. This works the same regardless of provider — it operates on the final text, not on the stream format. No changes needed.

---

## Phase 3: Provider Configuration

### Task 3.1: Support multiple provider keys

**Files:**
- Modify: `supabase/functions/_shared/aiAgent/provider.ts`
- Modify: `supabase/functions/ai-assistant-chat/index.ts`
- Modify: `supabase/functions/ai-assistant-agent/index.ts`

- [ ] **Step 1: Resolve all available provider keys**

Use the existing `getProviderKey()` pattern to check for each provider:

```ts
const openaiKey = await getProviderKey(supabase, userId, 'openai', 'OPENAI_API_KEY');
const anthropicKey = await getProviderKey(supabase, userId, 'anthropic', 'ANTHROPIC_API_KEY');
const openrouterKey = await getProviderKey(supabase, userId, 'openrouter', 'OPENROUTER_API_KEY');

const registry = createRegistry({
  openaiKey: openaiKey || undefined,
  anthropicKey: anthropicKey || undefined,
  openrouterKey: openrouterKey || undefined,
});
```

- [ ] **Step 2: Accept model parameter from the client (optional)**

Add an optional `model` field to the request body. If provided, use it; otherwise fall back to `DEFAULT_MODEL`:

```ts
const { messages, mode, model } = await req.json();
const modelId = model || DEFAULT_MODEL; // e.g., 'anthropic:claude-sonnet-4-20250514'
const result = streamText({
  model: registry.languageModel(modelId),
  // ...
});
```

This enables the frontend to add a model picker later without any backend changes.

- [ ] **Step 3: Validate the requested model has a valid key**

If the client requests `anthropic:claude-sonnet-4-20250514` but no Anthropic key is configured, return a clear 400 error:

```json
{ "error": "No API key configured for provider 'anthropic'" }
```

---

## Deployment

After all phases are complete, tell the developer to run:

```bash
npm run deploy
```

This pushes both the migration files and edge function changes. **Claude must not run this command.**

---

## Verification Checklist

After deployment, manually test each mode:

- [ ] **Chat mode** — Send a message, verify streaming response works
- [ ] **Assist mode** — Ask for a CRM action, verify `<action>` tags appear and can be confirmed
- [ ] **Agent mode** — Ask to update a lead, verify tool execution SSE events stream correctly, verify undo works
- [ ] **Provider switch** — If Anthropic key is configured, change `DEFAULT_MODEL` to `anthropic:claude-sonnet-4-20250514` and verify all 3 modes work
- [ ] **Undo/redo** — Verify `ai_agent_changes` still logs correctly, undo and redo work from the UI
- [ ] **Rate limiting** — Verify rate limits still enforce (unchanged, but confirm)

---

## Summary of Changes

| What | Before | After |
|---|---|---|
| LLM calls | Raw `fetch()` to OpenAI API | `streamText()` / `generateText()` via Vercel AI SDK |
| Streaming format | OpenAI SSE (`data: {"choices":[...]}`) | Plain text stream (`toTextStreamResponse()`) |
| Tool definitions | Raw JSON schema (6 tools) | Zod schemas via `tool()` (6 tools) |
| Provider support | OpenAI only (hardcoded) | OpenAI + Anthropic + OpenRouter via registry |
| Frontend SSE parsing | ~150 lines of manual buffer parsing (3x duplication) | ~30 lines of plain text reading |
| Model selection | Hardcoded `gpt-4o-mini` | Configurable via `DEFAULT_MODEL` constant + optional client param |
| Undo/redo system | Unchanged | Unchanged |
| Action parsing (assist mode) | Unchanged (`<action>` XML tags) | Unchanged |
