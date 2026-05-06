# Split `ai-assistant` and `dropbox-api` Edge Functions — Issue #84

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the work started in issue #84 by splitting the remaining oversized edge functions — `ai-assistant` (1065 LOC) and `dropbox-api` (737 LOC) — into smaller, action-scoped functions that share helpers via `_shared/`.

**Architecture:** Mirror the gmail-api split pattern that already shipped (`gmail-auth` / `gmail-mailbox` / `gmail-write` + `_shared/gmail/api.ts`). Each new function keeps the standard `OPTIONS → rate-limit → auth → parse → work` shape. Common code (DB executor, OpenAI tool definitions, Dropbox token helpers) moves to `supabase/functions/_shared/`. A small client-side router (`src/lib/aiAssistantRouter.ts`, `src/lib/dropboxRouter.ts`) maps action names to function names so callers stay clean. No behavior changes — every existing request shape continues to work.

**Tech Stack:** Deno edge functions, Supabase JS, TypeScript. **No automated tests in this repo** (per CLAUDE.md) — verification is done via manual smoke tests in the running app and curl checks.

**Out of scope:** Optimizing the AI prompt, changing rate limits per action, refactoring caller hooks beyond what the router migration requires.

---

## File Structure

### New edge functions

| Function | Responsibility | Approx LOC |
|---|---|---|
| `supabase/functions/ai-assistant-chat/index.ts` | Streaming chat for chat + assist modes (no `body.action`) | ~250 |
| `supabase/functions/ai-assistant-agent/index.ts` | Autonomous agent (`action: "agent"`), SSE tool-calling loop | ~250 |
| `supabase/functions/ai-assistant-actions/index.ts` | `execute`, `undo`, `redo`, `undo_batch` lifecycle | ~150 |
| `supabase/functions/dropbox-files/index.ts` | Read ops: `list`, `list-recursive`, `list-shared`, `get-temporary-link`, `download` | ~200 |
| `supabase/functions/dropbox-mutations/index.ts` | Mutations: `upload`, `upload-to-lead-folder`, `move`, `rename`, `delete`, `create-folder` | ~300 |
| `supabase/functions/dropbox-search/index.ts` | DB-only: `link-to-lead`, `search-content` | ~120 |

### New shared modules

| File | Exports |
|---|---|
| `supabase/functions/_shared/aiAgent/executor.ts` | `executeAction`, `undoChange`, `redoChange` |
| `supabase/functions/_shared/aiAgent/tools.ts` | `agentTools` (OpenAI function definitions) |
| `supabase/functions/_shared/aiAgent/context.ts` | `buildChatContext(supabase, scopedMemberId, displayName)` returning the markdown context string |
| `supabase/functions/_shared/dropbox/api.ts` | `getValidAccessToken`, `refreshDropboxToken`, `parseDropboxApiError`, `sanitizeDropboxPath` |

### Client routers

| File | Purpose |
|---|---|
| `src/lib/aiAssistantRouter.ts` | Maps an AI request shape → function name (`ai-assistant-chat` / `ai-assistant-agent` / `ai-assistant-actions`) |
| `src/lib/dropboxRouter.ts` | Maps a Dropbox action → function name (mirrors `src/lib/gmailRouter.ts`) |

### Files to delete at the end (after callers migrate)

- `supabase/functions/ai-assistant/index.ts`
- `supabase/functions/dropbox-api/index.ts`

### Files to modify (callers)

- `src/components/ai/CLXAssistant.tsx` (3 call sites at lines 284, 382, 493)
- `src/hooks/useAIChanges.ts` (3 call sites at lines 115, 140, 165)
- `src/hooks/useActionExecutor.ts` (2 call sites at lines 32, 75)
- `src/hooks/useDropbox.ts` (the `invokeDropboxApi` helper)
- `supabase/config.toml` (register new function entries with `verify_jwt = false`)

### Reference docs to update

- `supabase/functions/CLAUDE.md` (catalog entries for the new functions; remove the old ones)

---

## Phase 1: Dropbox Split (smaller, lower-risk — do first)

### Task 1: Extract Dropbox shared helpers

**Files:**
- Create: `supabase/functions/_shared/dropbox/api.ts`

- [ ] **Step 1: Create the shared module**

Move the four helpers from `supabase/functions/dropbox-api/index.ts` lines 15–95 and 333 verbatim:

```ts
// supabase/functions/_shared/dropbox/api.ts
// Dropbox API helpers shared by dropbox-files, dropbox-mutations, dropbox-search edge functions.

const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')!;
const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')!;

export interface DropboxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function refreshDropboxToken(refreshToken: string): Promise<DropboxTokenResponse> {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox token refresh error:', error);
    throw new Error('Failed to refresh Dropbox token');
  }

  return response.json();
}

export function parseDropboxApiError(operation: string, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText);
    const requiredScope = parsed?.error?.required_scope;
    const errorTag = parsed?.error?.['.tag'];

    if (errorTag === 'missing_scope' && requiredScope) {
      return `Dropbox app is missing required scope: ${requiredScope}. Update Dropbox app permissions and reconnect Dropbox.`;
    }

    if (parsed?.error_summary) {
      return `Failed to ${operation}: ${parsed.error_summary}`;
    }
  } catch {
    // non-JSON error response
  }

  return `Failed to ${operation}`;
}

export async function getValidAccessToken(supabase: any): Promise<string> {
  const { data: connection, error } = await supabase
    .from('dropbox_connections')
    .select('*')
    .limit(1)
    .single();

  if (error || !connection) {
    throw new Error('Dropbox not connected');
  }

  const tokenExpiry = new Date(connection.token_expiry);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Refreshing Dropbox access token...');
    const tokens = await refreshDropboxToken(connection.refresh_token);

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('dropbox_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq('id', connection.id);

    return tokens.access_token;
  }

  return connection.access_token;
}

export function sanitizeDropboxPath(name: string): string {
  // Copy the exact body from supabase/functions/dropbox-api/index.ts:333
  // (do not paraphrase — verbatim move).
}
```

- [ ] **Step 2: Verify Deno can import it**

Run: `deno check supabase/functions/_shared/dropbox/api.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/dropbox/api.ts
git commit -m "refactor(dropbox): extract shared API helpers (issue #84)"
```

---

### Task 2: Create `dropbox-files` (read operations)

**Files:**
- Create: `supabase/functions/dropbox-files/index.ts`

- [ ] **Step 1: Scaffold the function**

```ts
// supabase/functions/dropbox-files/index.ts
import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { getValidAccessToken } from '../_shared/dropbox/api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Move these handlers verbatim from supabase/functions/dropbox-api/index.ts:
//   handleList            (line 99)
//   handleGetTemporaryLink (line 202)
//   handleListShared       (line 433)
//   handleListRecursive    (line 463)
// Drop the leading `async function` and add `export` if you prefer, or keep
// them as locals inside this file. Do NOT change their signatures or bodies.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-files', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body.action || new URL(req.url).searchParams.get('action');

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseAdmin);
    } catch {
      return new Response(JSON.stringify({ error: 'Dropbox not connected', needsAuth: true }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: any;
    switch (action) {
      case 'list':
        result = await handleList(accessToken, body);
        break;
      case 'download':
      case 'get-temporary-link':
        result = await handleGetTemporaryLink(accessToken, body);
        break;
      case 'list-recursive':
        result = await handleListRecursive(accessToken, body);
        break;
      case 'list-shared':
        result = await handleListShared(accessToken);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('dropbox-files error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Register in `supabase/config.toml`**

Add after the existing `[functions.dropbox-api]` block:

```toml
[functions.dropbox-files]
verify_jwt = false
```

- [ ] **Step 3: Type-check**

Run: `deno check supabase/functions/dropbox-files/index.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/dropbox-files/index.ts supabase/config.toml
git commit -m "feat(dropbox-files): add read-ops edge function (issue #84)"
```

---

### Task 3: Create `dropbox-mutations` (write operations)

**Files:**
- Create: `supabase/functions/dropbox-mutations/index.ts`

- [ ] **Step 1: Scaffold the function**

Use the exact same scaffold as Task 2, but:
- Function name in `enforceRateLimit`: `'dropbox-mutations'`
- Move these handlers verbatim from `supabase/functions/dropbox-api/index.ts`:
  - `handleUpload` (line 142) — needs `supabaseAdmin`
  - `handleMove` (line 228) — needs `supabaseAdmin`
  - `handleDelete` (line 271) — needs `supabaseAdmin`
  - `handleCreateFolder` (line 304)
  - `handleUploadToLeadFolder` (line 337) — needs `supabaseAdmin`, also imports `sanitizeDropboxPath`
- Switch cases:
  - `'upload'` → `handleUpload(accessToken, body, supabaseAdmin)`
  - `'move'` / `'rename'` → `handleMove(accessToken, body, supabaseAdmin)`
  - `'delete'` → `handleDelete(accessToken, body, supabaseAdmin)`
  - `'create-folder'` → `handleCreateFolder(accessToken, body)`
  - `'upload-to-lead-folder'` → `handleUploadToLeadFolder(accessToken, body, supabaseAdmin)`

- [ ] **Step 2: Register in `supabase/config.toml`**

```toml
[functions.dropbox-mutations]
verify_jwt = false
```

- [ ] **Step 3: Type-check**

Run: `deno check supabase/functions/dropbox-mutations/index.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/dropbox-mutations/index.ts supabase/config.toml
git commit -m "feat(dropbox-mutations): add write-ops edge function (issue #84)"
```

---

### Task 4: Create `dropbox-search` (DB-only operations)

**Files:**
- Create: `supabase/functions/dropbox-search/index.ts`

- [ ] **Step 1: Scaffold the function**

This one differs from Tasks 2/3 because `link-to-lead` and `search-content` do NOT need a Dropbox access token — they only hit the local Postgres `dropbox_files` table.

```ts
import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Move handleLinkToLead (line 532) and handleSearchContent (line 555) verbatim
// from supabase/functions/dropbox-api/index.ts.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-search', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body.action || new URL(req.url).searchParams.get('action');

    let result: any;
    switch (action) {
      case 'link-to-lead':
        result = await handleLinkToLead(body, supabaseAdmin);
        break;
      case 'search-content':
        result = await handleSearchContent(body, supabaseAdmin);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('dropbox-search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Register in `supabase/config.toml`**

```toml
[functions.dropbox-search]
verify_jwt = false
```

- [ ] **Step 3: Type-check**

Run: `deno check supabase/functions/dropbox-search/index.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/dropbox-search/index.ts supabase/config.toml
git commit -m "feat(dropbox-search): add DB-only ops edge function (issue #84)"
```

---

### Task 5: Add Dropbox client router

**Files:**
- Create: `src/lib/dropboxRouter.ts`

- [ ] **Step 1: Create the router**

```ts
// src/lib/dropboxRouter.ts
// Maps a Dropbox action to the edge function that handles it.
// dropbox-api was split per issue #84.

const DROPBOX_ACTION_TO_FUNCTION: Record<string, 'dropbox-files' | 'dropbox-mutations' | 'dropbox-search'> = {
  // dropbox-files (read)
  'list': 'dropbox-files',
  'list-recursive': 'dropbox-files',
  'list-shared': 'dropbox-files',
  'download': 'dropbox-files',
  'get-temporary-link': 'dropbox-files',

  // dropbox-mutations (write)
  'upload': 'dropbox-mutations',
  'upload-to-lead-folder': 'dropbox-mutations',
  'move': 'dropbox-mutations',
  'rename': 'dropbox-mutations',
  'delete': 'dropbox-mutations',
  'create-folder': 'dropbox-mutations',

  // dropbox-search (DB-only)
  'link-to-lead': 'dropbox-search',
  'search-content': 'dropbox-search',
};

export function dropboxActionToFunction(action: string): string {
  const fn = DROPBOX_ACTION_TO_FUNCTION[action];
  if (!fn) {
    throw new Error(`Unknown Dropbox action: ${action}`);
  }
  return fn;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dropboxRouter.ts
git commit -m "feat(dropbox): add client-side action router (issue #84)"
```

---

### Task 6: Migrate `useDropbox.ts` to the router

**Files:**
- Modify: `src/hooks/useDropbox.ts:27-34`

- [ ] **Step 1: Update `invokeDropboxApi`**

Replace the existing helper at lines 27–34:

```ts
import { dropboxActionToFunction } from '@/lib/dropboxRouter';

export async function invokeDropboxApi(action: string, body?: Record<string, unknown>) {
  const fnName = dropboxActionToFunction(action);
  const { data, error } = await supabase.functions.invoke(fnName, {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || 'Dropbox API error');
  if (data?.error) throw new Error(data.error);
  return data;
}
```

- [ ] **Step 2: Type-check the project**

Run: `npm run lint`
Expected: No new errors. (The lint command also surfaces TS errors via the eslint TS plugin in this repo.)

- [ ] **Step 3: Smoke-test in dev**

Run: `npm run dev`

Then manually verify in the browser at `/admin/dropbox`:
1. The file list loads (calls `list` → `dropbox-files`).
2. Upload a small file (calls `upload` → `dropbox-mutations`).
3. Rename it (calls `move` → `dropbox-mutations`).
4. Delete it (calls `delete` → `dropbox-mutations`).
5. Search content from the search bar (calls `search-content` → `dropbox-search`).
6. Open the lead detail dialog and link a Dropbox file (calls `link-to-lead` → `dropbox-search`).

Watch the browser network tab to confirm requests now go to the new function URLs (not `/dropbox-api`).

Expected: All operations succeed exactly as before. Network requests target `dropbox-files`, `dropbox-mutations`, or `dropbox-search` based on the action.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDropbox.ts
git commit -m "feat(dropbox): route useDropbox via dropboxRouter (issue #84)"
```

---

### Task 7: Delete the old `dropbox-api` function

**Files:**
- Delete: `supabase/functions/dropbox-api/index.ts`
- Modify: `supabase/config.toml` (remove `[functions.dropbox-api]` block)
- Modify: `supabase/functions/CLAUDE.md` (replace the `dropbox-api` catalog line with three new lines)

- [ ] **Step 1: Confirm no callers remain**

Run: `grep -rn "dropbox-api" /Users/ilanfridman/trusted-deal-navigator/src /Users/ilanfridman/trusted-deal-navigator/supabase`
Expected: Only matches in `supabase/functions/CLAUDE.md` (about to be edited) and possibly in unrelated docs/comments. No live code references.

If the grep shows live `supabase.functions.invoke('dropbox-api', ...)` calls, STOP and migrate them before continuing.

- [ ] **Step 2: Remove the old function and config block**

```bash
rm -rf /Users/ilanfridman/trusted-deal-navigator/supabase/functions/dropbox-api
```

Then edit `supabase/config.toml` and remove these two lines:

```toml
[functions.dropbox-api]
verify_jwt = false
```

- [ ] **Step 3: Update `supabase/functions/CLAUDE.md`**

Find the line:

```
- `dropbox-api` — generic API wrapper with proactive token refresh (5-min buffer)
```

Replace it with:

```
- `dropbox-files` — read ops: list, list-recursive, list-shared, get-temporary-link, download (60/60s). Issue #84 split.
- `dropbox-mutations` — write ops: upload, upload-to-lead-folder, move, rename, delete, create-folder (60/60s). Issue #84 split.
- `dropbox-search` — DB-only: link-to-lead, search-content (60/60s). Issue #84 split.
- Shared helpers in `_shared/dropbox/api.ts` (token refresh, error parsing, path sanitizer).
```

- [ ] **Step 4: Final smoke test**

Repeat Task 6 Step 3. All operations must still pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/dropbox-api supabase/config.toml supabase/functions/CLAUDE.md
git commit -m "refactor(dropbox): remove old dropbox-api function (issue #84)"
```

---

## Phase 2: AI Assistant Split (larger — do after Phase 1 ships green)

### Task 8: Extract AI agent shared modules

**Files:**
- Create: `supabase/functions/_shared/aiAgent/executor.ts`
- Create: `supabase/functions/_shared/aiAgent/tools.ts`
- Create: `supabase/functions/_shared/aiAgent/context.ts`

- [ ] **Step 1: Create `executor.ts`**

Move three functions verbatim from `supabase/functions/ai-assistant/index.ts`:
- `executeAction` (lines 14–276)
- `undoChange` (lines 279–318)
- `redoChange` (lines 321–360)

Add `export` to each. Keep the `createClient` import from `../supabase.ts`. The file should look like:

```ts
// supabase/functions/_shared/aiAgent/executor.ts
import { createClient } from '../supabase.ts';

export async function executeAction(
  supabase: ReturnType<typeof createClient>,
  actionType: string,
  params: Record<string, string>,
  userId: string,
  teamMemberId: string | null,
  conversationId: string | null,
  mode: 'assist' | 'agent',
  batchId: string | null,
  batchOrder: number,
  isOwner: boolean,
): Promise<{ success: boolean; description: string; changeId?: string }> {
  // ...verbatim body from ai-assistant/index.ts:27-275
}

export async function undoChange(
  supabase: ReturnType<typeof createClient>,
  changeId: string,
  userId: string,
) {
  // ...verbatim body from ai-assistant/index.ts:280-317
}

export async function redoChange(
  supabase: ReturnType<typeof createClient>,
  changeId: string,
) {
  // ...verbatim body from ai-assistant/index.ts:322-359
}
```

- [ ] **Step 2: Create `tools.ts`**

```ts
// supabase/functions/_shared/aiAgent/tools.ts
// OpenAI tool definitions for AI agent mode.

export const agentTools = [
  // ...verbatim array from ai-assistant/index.ts:363-459
];
```

- [ ] **Step 3: Create `context.ts`**

Wrap the chat context-building logic (lines 808–957 of `ai-assistant/index.ts`) into a single function. The current implementation does ~6 sequential queries then builds a long markdown string — keep that exact behavior.

```ts
// supabase/functions/_shared/aiAgent/context.ts
import { createClient } from '../supabase.ts';

export async function buildChatContext(
  supabase: ReturnType<typeof createClient>,
  scopedMemberId: string | undefined,
  displayName: string,
): Promise<string> {
  if (!scopedMemberId) return '';

  // ...verbatim body of the `if (scopedMemberId) { ... }` block from
  // ai-assistant/index.ts:810-957, returning the assembled `contextData`
  // string at the end. Keep all six queries and both string-template sections
  // (CRM data + Dropbox files) exactly as they are today.

  return contextData;
}
```

- [ ] **Step 4: Type-check**

Run: `deno check supabase/functions/_shared/aiAgent/executor.ts supabase/functions/_shared/aiAgent/tools.ts supabase/functions/_shared/aiAgent/context.ts`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/aiAgent
git commit -m "refactor(ai-assistant): extract executor, tools, context to _shared (issue #84)"
```

---

### Task 9: Create `ai-assistant-actions` (execute / undo / redo / undo_batch)

**Files:**
- Create: `supabase/functions/ai-assistant-actions/index.ts`

- [ ] **Step 1: Scaffold the function**

```ts
// supabase/functions/ai-assistant-actions/index.ts
import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { executeAction, undoChange, redoChange } from '../_shared/aiAgent/executor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-actions', 30, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { authUserId, teamMember, isOwner } = await getUserFromRequest(req, supabase);

    if (action === 'execute') {
      // ...verbatim body from ai-assistant/index.ts:468-506
      // (creates a batch, calls executeAction, returns JSON)
    }

    if (action === 'undo') {
      const result = await undoChange(supabase, body.changeId, authUserId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'redo') {
      const result = await redoChange(supabase, body.changeId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'undo_batch') {
      // ...verbatim body from ai-assistant/index.ts:525-555
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('ai-assistant-actions error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 2: Register in `supabase/config.toml`**

```toml
[functions.ai-assistant-actions]
verify_jwt = false
```

- [ ] **Step 3: Type-check**

Run: `deno check supabase/functions/ai-assistant-actions/index.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-assistant-actions/index.ts supabase/config.toml
git commit -m "feat(ai-assistant-actions): add execute/undo/redo edge function (issue #84)"
```

---

### Task 10: Create `ai-assistant-agent` (autonomous tool-calling)

**Files:**
- Create: `supabase/functions/ai-assistant-agent/index.ts`

- [ ] **Step 1: Scaffold the function**

```ts
// supabase/functions/ai-assistant-agent/index.ts
import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { executeAction } from '../_shared/aiAgent/executor.ts';
import { agentTools } from '../_shared/aiAgent/tools.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-agent', 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { authUserId, teamMember, isOwner } = await getUserFromRequest(req, supabase);

    // ...verbatim body from ai-assistant/index.ts:560-764
    // (the entire `if (action === "agent") { ... }` block, minus the
    // `const { prompt, conversationId, teamMemberId: tmId } = body;` line which
    // stays). Returns the SSE Response.
  } catch (error) {
    console.error('ai-assistant-agent error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 2: Register in `supabase/config.toml`**

```toml
[functions.ai-assistant-agent]
verify_jwt = false
```

- [ ] **Step 3: Type-check**

Run: `deno check supabase/functions/ai-assistant-agent/index.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-assistant-agent/index.ts supabase/config.toml
git commit -m "feat(ai-assistant-agent): add autonomous agent edge function (issue #84)"
```

---

### Task 11: Create `ai-assistant-chat` (streaming chat)

**Files:**
- Create: `supabase/functions/ai-assistant-chat/index.ts`

- [ ] **Step 1: Scaffold the function**

```ts
// supabase/functions/ai-assistant-chat/index.ts
import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { buildChatContext } from '../_shared/aiAgent/context.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-chat', 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { teamMember, isOwner } = await getUserFromRequest(req, supabase);

    const body = await req.json();
    const { messages, teamMemberId: requestedMemberId, mode = 'chat', currentPage = '' } = body;
    const scopedMemberId = isOwner ? (requestedMemberId || teamMember?.id) : teamMember?.id;
    const displayName = teamMember?.name?.trim() || 'there';

    const contextData = await buildChatContext(supabase, scopedMemberId, displayName);

    // ...verbatim from ai-assistant/index.ts:959-1054 starting at:
    //   const pageContext = currentPage ? `\n\n## Current Page\n...
    // and ending with the streaming Response return.
  } catch (error) {
    console.error('ai-assistant-chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 2: Register in `supabase/config.toml`**

```toml
[functions.ai-assistant-chat]
verify_jwt = false
```

- [ ] **Step 3: Type-check**

Run: `deno check supabase/functions/ai-assistant-chat/index.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-assistant-chat/index.ts supabase/config.toml
git commit -m "feat(ai-assistant-chat): add streaming chat edge function (issue #84)"
```

---

### Task 12: Add AI assistant client router

**Files:**
- Create: `src/lib/aiAssistantRouter.ts`

- [ ] **Step 1: Create the router**

The AI assistant has two request shapes (chat: no `action`; everything else: `action` set), so the router takes the body and returns the function name.

```ts
// src/lib/aiAssistantRouter.ts
// Maps an AI assistant request body to the edge function that handles it.
// ai-assistant was split per issue #84.

type AIAssistantFunction = 'ai-assistant-chat' | 'ai-assistant-agent' | 'ai-assistant-actions';

const ACTION_TO_FUNCTION: Record<string, AIAssistantFunction> = {
  agent: 'ai-assistant-agent',
  execute: 'ai-assistant-actions',
  undo: 'ai-assistant-actions',
  redo: 'ai-assistant-actions',
  undo_batch: 'ai-assistant-actions',
};

export function aiAssistantFunctionFor(body: { action?: string }): AIAssistantFunction {
  if (!body.action) return 'ai-assistant-chat';
  const fn = ACTION_TO_FUNCTION[body.action];
  if (!fn) {
    throw new Error(`Unknown AI assistant action: ${body.action}`);
  }
  return fn;
}

export function aiAssistantUrl(body: { action?: string }): string {
  const fn = aiAssistantFunctionFor(body);
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/aiAssistantRouter.ts
git commit -m "feat(ai-assistant): add client-side request router (issue #84)"
```

---

### Task 13: Migrate `useActionExecutor.ts` to the router

**Files:**
- Modify: `src/hooks/useActionExecutor.ts:32` and `:75`

- [ ] **Step 1: Read the current hook**

Run: `cat /Users/ilanfridman/trusted-deal-navigator/src/hooks/useActionExecutor.ts`

The two `fetch` calls hit `/functions/v1/ai-assistant`. Both send `body.action` set to one of `execute`, `undo`, `redo`, `undo_batch`.

- [ ] **Step 2: Replace the URLs**

For each of the two `fetch` calls, change:

```ts
`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`
```

To:

```ts
aiAssistantUrl(requestBody)
```

(where `requestBody` is the same object passed as `JSON.stringify(...)` for that fetch). Add the import at the top: `import { aiAssistantUrl } from '@/lib/aiAssistantRouter';`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useActionExecutor.ts
git commit -m "refactor(ai-assistant): route useActionExecutor via aiAssistantRouter (issue #84)"
```

---

### Task 14: Migrate `useAIChanges.ts` to the router

**Files:**
- Modify: `src/hooks/useAIChanges.ts:115`, `:140`, `:165`

- [ ] **Step 1: Read the current hook**

Run: `cat /Users/ilanfridman/trusted-deal-navigator/src/hooks/useAIChanges.ts`

Three `fetch` calls; each sends `body.action` set to `undo`, `redo`, or `undo_batch`.

- [ ] **Step 2: Replace the URLs**

Same pattern as Task 13. Replace each hardcoded URL with `aiAssistantUrl(bodyObject)`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAIChanges.ts
git commit -m "refactor(ai-assistant): route useAIChanges via aiAssistantRouter (issue #84)"
```

---

### Task 15: Migrate `CLXAssistant.tsx` to the router

**Files:**
- Modify: `src/components/ai/CLXAssistant.tsx:284`, `:382`, `:493`

- [ ] **Step 1: Read the current component**

Run: `grep -n "ai-assistant" /Users/ilanfridman/trusted-deal-navigator/src/components/ai/CLXAssistant.tsx`

Confirm three call sites. Determine for each call site whether it sends `body.action` (agent / execute / etc.) or just `body.messages` (chat).

- [ ] **Step 2: Replace the URLs**

For each call site, replace the hardcoded URL with `aiAssistantUrl(body)` where `body` is the same object passed in `JSON.stringify(...)`.

Add at the top:

```ts
import { aiAssistantUrl } from '@/lib/aiAssistantRouter';
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 4: Smoke-test in dev**

Run: `npm run dev`. Open `/superadmin` (or any admin route with the CLX assistant visible). Verify:

1. **Chat mode** — ask "show my pipeline summary". Streamed text response renders. Network tab shows POST to `ai-assistant-chat`.
2. **Assist mode** — ask "draft a follow-up to my oldest lead". Action tags render as confirmable cards. Click one. Network tab shows POST to `ai-assistant-actions` (action=`execute`).
3. **Agent mode** — ask "mark task X as complete". Tool calls stream. Network tab shows POST to `ai-assistant-agent` (action=`agent`).
4. **Undo** — open the AI changes panel, click Undo on a recent change. Network tab shows POST to `ai-assistant-actions` (action=`undo`).

Expected: All four scenarios work and route to the right new function.

- [ ] **Step 5: Commit**

```bash
git add src/components/ai/CLXAssistant.tsx
git commit -m "refactor(ai-assistant): route CLXAssistant via aiAssistantRouter (issue #84)"
```

---

### Task 16: Delete the old `ai-assistant` function

**Files:**
- Delete: `supabase/functions/ai-assistant/index.ts`
- Modify: `supabase/functions/CLAUDE.md`

- [ ] **Step 1: Confirm no callers remain**

Run: `grep -rn "'ai-assistant'\|\"ai-assistant\"\|/ai-assistant" /Users/ilanfridman/trusted-deal-navigator/src /Users/ilanfridman/trusted-deal-navigator/supabase`

Expected: Only matches in docs (CLAUDE.md) and unrelated identifiers like `ai-assistant-size` (a localStorage key). NO live `supabase.functions.invoke('ai-assistant', ...)` calls and no `/functions/v1/ai-assistant` URLs.

If any live caller remains, STOP and migrate it.

- [ ] **Step 2: Delete the function**

```bash
rm -rf /Users/ilanfridman/trusted-deal-navigator/supabase/functions/ai-assistant
```

Note: `ai-assistant` was never registered in `supabase/config.toml` (it relied on defaults), so no config change needed here.

- [ ] **Step 3: Update `supabase/functions/CLAUDE.md`**

Find the line:

```
- `ai-assistant` — merged assistant + agent executor. Uses OpenAI. Resolves the calling team member from the JWT.
```

Replace with:

```
- `ai-assistant-chat` — streaming chat for chat + assist modes. Uses OpenAI. Resolves caller from JWT (10/60s). Issue #84 split.
- `ai-assistant-agent` — autonomous tool-calling agent (action=`agent`). Streams SSE (10/60s). Issue #84 split.
- `ai-assistant-actions` — single-action lifecycle: execute, undo, redo, undo_batch (30/60s). Issue #84 split.
- Shared logic in `_shared/aiAgent/` (executor.ts, tools.ts, context.ts).
```

- [ ] **Step 4: Final smoke test**

Repeat Task 15 Step 4 — all four scenarios still work.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ai-assistant supabase/functions/CLAUDE.md
git commit -m "refactor(ai-assistant): remove old ai-assistant function (issue #84)"
```

---

## Phase 3: Wrap up

### Task 17: Verify LOC reduction and update issue

**Files:** none

- [ ] **Step 1: Confirm all new functions are under 700 LOC**

Run:

```bash
wc -l /Users/ilanfridman/trusted-deal-navigator/supabase/functions/{ai-assistant-chat,ai-assistant-agent,ai-assistant-actions,dropbox-files,dropbox-mutations,dropbox-search}/index.ts
```

Expected: Every file under 500 LOC, target ~150–300 each.

- [ ] **Step 2: Confirm the old files are gone**

Run:

```bash
ls /Users/ilanfridman/trusted-deal-navigator/supabase/functions/ai-assistant 2>&1
ls /Users/ilanfridman/trusted-deal-navigator/supabase/functions/dropbox-api 2>&1
```

Expected: Both `No such file or directory`.

- [ ] **Step 3: Deploy to Supabase**

The user deploys via their normal flow (CI or `supabase functions deploy`). Confirm with the user before running deploy commands directly.

- [ ] **Step 4: Post a comment on issue #84**

Suggest the user post:

> Done. `ai-assistant` is now `ai-assistant-chat` (~250 LOC), `ai-assistant-agent` (~250 LOC), `ai-assistant-actions` (~150 LOC) sharing helpers in `_shared/aiAgent/`. `dropbox-api` is now `dropbox-files` (~200 LOC), `dropbox-mutations` (~300 LOC), `dropbox-search` (~120 LOC) sharing helpers in `_shared/dropbox/api.ts`. Closes #84.

(The user posts this themselves — do not auto-post to GitHub.)

---

## Self-Review Notes

- Every existing action is mapped to exactly one new function (verified against the `case` lists in both old files and the three calling shapes for ai-assistant).
- Every existing caller (`useDropbox`, `useActionExecutor`, `useAIChanges`, `CLXAssistant`) has a migration task.
- Rate limits are preserved per function (60/60s for dropbox functions, 10/60s for AI chat/agent matching the old default, 30/60s for the action lifecycle since execute/undo are short ops).
- All `verify_jwt = false` config entries match the pattern used by the gmail split functions.
- Phase 1 (Dropbox) is sequenced first because it's smaller, has fewer callers, and validates the pattern before tackling AI.
- Each phase ends with a deletion task that cannot run until grep confirms zero live callers — preventing any window where the app references a missing function.
