# AI Events Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five AI tables (`ai_conversations`, `ai_conversation_messages`, `ai_audit_log`, `ai_agent_batches`, `ai_agent_changes`) with a single `ai_events` table.

**Architecture:** One table with an `event_type` enum discriminator, a self-referencing `parent_id` (ON DELETE CASCADE) that preserves the old relationships, and a `payload jsonb` holding all type-specific fields. A data migration moves existing rows (ids preserved so links resolve), then drops the old tables. Every reader/writer of the old tables is repointed at `ai_events` in the same change.

**Tech Stack:** Supabase Postgres + Deno edge functions, React + TanStack Query frontend.

**Spec:** `docs/superpowers/specs/2026-06-04-ai-events-consolidation-design.md`

**Environment note:** `deno` is installed but not on PATH — prefix deno commands with `export PATH="$HOME/.deno/bin:$PATH"`. There is no JS/SQL unit-test framework in this repo; verification is `deno check` (edge TS), `npm run build` (frontend), and post-deploy manual checks. The remote `db push`/`functions deploy` happen in the final task. App is pre-production with fake data, so the destructive migration is low-risk.

---

## File Structure

| File | Change |
|---|---|
| `supabase/migrations/20260604160000_ai_events_consolidation.sql` (create) | enum + `ai_events` + indexes + RLS + data migration + drop 5 old tables |
| `supabase/functions/_shared/aiAgent/audit.ts` (modify) | write `audit` events into `ai_events` |
| `supabase/functions/ai-assistant-agent/index.ts` (modify) | `agent_batch` events |
| `supabase/functions/_shared/aiAgent/executor.ts` (modify) | `agent_change` events + undo/redo via `payload` |
| `supabase/functions/ai-assistant-actions/index.ts` (modify) | batch create + `undo_batch` over `ai_events` |
| `src/contexts/AIAssistantContext.tsx` (modify) | `conversation` + `message` events |

---

## Task 1: Migration — `ai_events` table + data migration + drop old tables

**Files:**
- Create: `supabase/migrations/20260604160000_ai_events_consolidation.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260604160000_ai_events_consolidation.sql
-- Collapse the five AI tables into a single ai_events table.
--   ai_conversations, ai_conversation_messages, ai_audit_log,
--   ai_agent_batches, ai_agent_changes  ->  ai_events
-- Relationships are preserved via a self-referencing parent_id; type-specific
-- columns move into a jsonb payload. Existing ids are preserved so parent links
-- resolve. Pre-production fake data => safe to drop the old tables at the end.

BEGIN;

CREATE TYPE public.ai_event_type AS ENUM
  ('conversation', 'message', 'audit', 'agent_batch', 'agent_change');

CREATE TABLE public.ai_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  public.ai_event_type NOT NULL,
  user_id     uuid,
  parent_id   uuid REFERENCES public.ai_events(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX ai_events_type_idx         ON public.ai_events (event_type);
CREATE INDEX ai_events_parent_idx       ON public.ai_events (parent_id);
CREATE INDEX ai_events_user_created_idx ON public.ai_events (user_id, created_at DESC);
CREATE INDEX ai_events_payload_idx      ON public.ai_events USING gin (payload);

-- 1) conversations (no parent)
INSERT INTO public.ai_events (id, event_type, user_id, parent_id, created_at, updated_at, payload)
SELECT c.id, 'conversation', c.user_id, NULL, c.created_at, c.updated_at,
       jsonb_build_object('title', c.title)
FROM public.ai_conversations c;

-- 2) messages (parent = conversation; user_id inherited from owner for RLS)
INSERT INTO public.ai_events (id, event_type, user_id, parent_id, created_at, updated_at, payload)
SELECT m.id, 'message', c.user_id, m.conversation_id, m.created_at, m.created_at,
       jsonb_build_object('role', m.role, 'content', m.content)
FROM public.ai_conversation_messages m
JOIN public.ai_conversations c ON c.id = m.conversation_id;

-- 3) audit (parent = conversation if it still exists, else null)
INSERT INTO public.ai_events (id, event_type, user_id, parent_id, created_at, updated_at, payload)
SELECT a.id, 'audit', a.user_id, c.id, a.occurred_at, a.occurred_at,
       jsonb_build_object(
         'function_name', a.function_name,
         'tool', a.tool,
         'scope', a.scope,
         'record_ids', to_jsonb(a.record_ids),
         'mode', a.mode,
         'success', a.success,
         'error_message', a.error_message)
FROM public.ai_audit_log a
LEFT JOIN public.ai_conversations c ON c.id = a.conversation_id;

-- 4) agent batches (parent = conversation if it exists, else null)
INSERT INTO public.ai_events (id, event_type, user_id, parent_id, created_at, updated_at, payload)
SELECT b.id, 'agent_batch', b.user_id, c.id, b.created_at, b.created_at,
       jsonb_build_object(
         'mode', b.mode,
         'prompt_summary', b.prompt_summary,
         'total_changes', b.total_changes,
         'status', b.status)
FROM public.ai_agent_batches b
LEFT JOIN public.ai_conversations c ON c.id = b.conversation_id;

-- 5) agent changes (parent = batch if present, else conversation if present, else null)
INSERT INTO public.ai_events (id, event_type, user_id, parent_id, created_at, updated_at, payload)
SELECT ch.id, 'agent_change', ch.user_id,
       COALESCE(b.id, c.id),
       ch.created_at, COALESCE(ch.undone_at, ch.created_at),
       jsonb_build_object(
         'conversation_id', ch.conversation_id,
         'team_member_id', ch.team_member_id,
         'mode', ch.mode,
         'target_table', ch.target_table,
         'target_id', ch.target_id,
         'operation', ch.operation,
         'old_values', ch.old_values,
         'new_values', ch.new_values,
         'description', ch.description,
         'ai_reasoning', ch.ai_reasoning,
         'status', ch.status,
         'undone_at', ch.undone_at,
         'undone_by', ch.undone_by,
         'batch_order', ch.batch_order,
         'model_used', ch.model_used)
FROM public.ai_agent_changes ch
LEFT JOIN public.ai_agent_batches b ON b.id = ch.batch_id
LEFT JOIN public.ai_conversations c ON c.id = ch.conversation_id;

-- Drop the old tables (children first; CASCADE clears dependent policies/constraints).
DROP TABLE IF EXISTS public.ai_agent_changes CASCADE;
DROP TABLE IF EXISTS public.ai_agent_batches CASCADE;
DROP TABLE IF EXISTS public.ai_conversation_messages CASCADE;
DROP TABLE IF EXISTS public.ai_audit_log CASCADE;
DROP TABLE IF EXISTS public.ai_conversations CASCADE;

-- RLS: a user owns their rows; edge functions use the service role (RLS bypassed).
ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_events_owner_select ON public.ai_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ai_events_owner_insert ON public.ai_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_events_owner_update ON public.ai_events
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_events_owner_delete ON public.ai_events
  FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;
```

- [ ] **Step 2: Sanity-check the SQL by review**

Confirm: one `BEGIN`/`COMMIT`; the 5 INSERTs run conversations-first so `parent_id` FKs resolve; every dropped table is one of the 5; `jsonb_build_object` key list for `agent_change` matches the executor reads in Task 4 (`target_table`, `target_id`, `operation`, `old_values`, `new_values`, `status`). No remote apply in this task — that happens in Task 6.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260604160000_ai_events_consolidation.sql
git commit -m "feat(ai): ai_events table + migrate the five AI tables into it"
```

---

## Task 2: Audit writes → `ai_events`

**Files:**
- Modify: `supabase/functions/_shared/aiAgent/audit.ts`

- [ ] **Step 1: Replace the insert body**

Replace the entire `logAiAudit` insert (the `await input.serviceClient.from('ai_audit_log').insert({ ... });` call) with an `ai_events` insert that puts the audit fields in `payload`:

```ts
    await input.serviceClient.from('ai_events').insert({
      event_type: 'audit',
      user_id: input.userId,
      parent_id: input.conversationId ?? null,
      payload: {
        function_name: input.functionName,
        tool: input.tool,
        scope: input.scope ?? {},
        record_ids: input.recordIds ?? [],
        mode: input.mode ?? null,
        success: input.success,
        error_message: input.errorMessage ?? null,
      },
    });
```

Leave the surrounding `try/catch` and the `AuditInput` interface unchanged.

- [ ] **Step 2: Type-check**

Run: `export PATH="$HOME/.deno/bin:$PATH"; deno check supabase/functions/_shared/aiAgent/audit.ts`
Expected: no errors in `audit.ts` (pre-existing `crypto.ts` lib-typing errors, if surfaced transitively, are unrelated).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/aiAgent/audit.ts
git commit -m "feat(ai): write audit rows as ai_events"
```

---

## Task 3: Agent batches → `ai_events`

**Files:**
- Modify: `supabase/functions/ai-assistant-agent/index.ts` (the batch insert near line 71 and the batch update near line 235)

- [ ] **Step 1: Repoint the batch insert**

Replace the batch-creation block:

```ts
      const { data: batch } = await serviceClient
        .from("ai_agent_batches")
        .insert({
          conversation_id: conversationId,
          user_id: authUserId,
          mode: "agent",
          prompt_summary: prompt.substring(0, 200),
          total_changes: 0,
        })
        .select("id")
        .single();
      batchId = batch?.id || null;
```

with:

```ts
      const { data: batch } = await serviceClient
        .from("ai_events")
        .insert({
          event_type: "agent_batch",
          user_id: authUserId,
          parent_id: conversationId,
          payload: {
            mode: "agent",
            prompt_summary: prompt.substring(0, 200),
            total_changes: 0,
            status: "applied",
          },
        })
        .select("id")
        .single();
      batchId = batch?.id || null;
```

- [ ] **Step 2: Repoint the batch total update**

Replace the batch-total update block:

```ts
              await serviceClient
                .from("ai_agent_batches")
                .update({ total_changes: totalChanges })
                .eq("id", batchId);
```

with (merge into the jsonb payload):

```ts
              await serviceClient
                .from("ai_events")
                .update({
                  payload: {
                    mode: "agent",
                    prompt_summary: prompt.substring(0, 200),
                    total_changes: totalChanges,
                    status: "applied",
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", batchId);
```

- [ ] **Step 3: Type-check**

Run: `export PATH="$HOME/.deno/bin:$PATH"; deno check supabase/functions/ai-assistant-agent/index.ts`
Expected: no errors in this file (crypto.ts noise unrelated).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-assistant-agent/index.ts
git commit -m "feat(ai): write agent batches as ai_events"
```

---

## Task 4: Agent changes + undo/redo → `ai_events`

**Files:**
- Modify: `supabase/functions/_shared/aiAgent/executor.ts`

The change rows move into `ai_events` (`event_type='agent_change'`) with all fields in `payload`. Reads pull from `change.payload`; status mutations merge the payload.

- [ ] **Step 1: Repoint the `create_task` change insert**

Replace:

```ts
        await supabase.from("ai_agent_changes").insert({
          conversation_id: conversationId,
          user_id: userId,
          team_member_id: teamMemberId,
          mode,
          target_table: "tasks",
          target_id: task.id,
          operation: "insert",
          old_values: null,
          new_values: taskData,
          description: `Created task: "${title}"${dueDate ? ` (due ${dueDate})` : ""}`,
          batch_id: batchId,
          batch_order: batchOrder,
        });
```

with:

```ts
        await supabase.from("ai_events").insert({
          event_type: "agent_change",
          user_id: userId,
          parent_id: batchId ?? conversationId,
          payload: {
            conversation_id: conversationId,
            team_member_id: teamMemberId,
            mode,
            target_table: "tasks",
            target_id: task.id,
            operation: "insert",
            old_values: null,
            new_values: taskData,
            description: `Created task: "${title}"${dueDate ? ` (due ${dueDate})` : ""}`,
            status: "applied",
            batch_order: batchOrder,
          },
        });
```

- [ ] **Step 2: Repoint the `complete_task` change insert**

Replace:

```ts
        await supabase.from("ai_agent_changes").insert({
          conversation_id: conversationId,
          user_id: userId,
          team_member_id: teamMemberId,
          mode,
          target_table: "tasks",
          target_id: taskId,
          operation: "update",
          old_values: { is_completed: false, status: current.status },
          new_values: { is_completed: true, status: "done" },
          description: `Completed task: "${current.title}"`,
          batch_id: batchId,
          batch_order: batchOrder,
        });
```

with:

```ts
        await supabase.from("ai_events").insert({
          event_type: "agent_change",
          user_id: userId,
          parent_id: batchId ?? conversationId,
          payload: {
            conversation_id: conversationId,
            team_member_id: teamMemberId,
            mode,
            target_table: "tasks",
            target_id: taskId,
            operation: "update",
            old_values: { is_completed: false, status: current.status },
            new_values: { is_completed: true, status: "done" },
            description: `Completed task: "${current.title}"`,
            status: "applied",
            batch_order: batchOrder,
          },
        });
```

- [ ] **Step 3: Rewrite `undoChange` to read/write `ai_events`**

Replace the whole `undoChange` function body (from its `const { data: change, error } = ...` through `return { success: true };`) with:

```ts
  const { data: event, error } = await supabase
    .from("ai_events")
    .select("*")
    .eq("id", changeId)
    .eq("event_type", "agent_change")
    .single();

  if (error || !event) throw new Error("Change not found");
  const change = event.payload as any;
  if (change.status !== "applied" && change.status !== "redone") {
    throw new Error(`Cannot undo change with status: ${change.status}`);
  }
  if (!isOwner && event.user_id !== userId) {
    throw new Error("Forbidden: cannot undo another user's change");
  }

  const { target_table, target_id, operation, old_values } = change;

  if (operation === "update" && old_values) {
    const { error: updateErr } = await supabase
      .from(target_table)
      .update(old_values)
      .eq("id", target_id);
    if (updateErr) throw new Error(`Undo failed: ${updateErr.message}`);
  } else if (operation === "insert") {
    const { error: deleteErr } = await supabase
      .from(target_table)
      .delete()
      .eq("id", target_id);
    if (deleteErr) throw new Error(`Undo failed: ${deleteErr.message}`);
  } else if (operation === "delete" && old_values) {
    const { error: insertErr } = await supabase
      .from(target_table)
      .insert({ id: target_id, ...old_values });
    if (insertErr) throw new Error(`Undo failed: ${insertErr.message}`);
  }

  await supabase
    .from("ai_events")
    .update({
      payload: { ...change, status: "undone", undone_at: new Date().toISOString(), undone_by: userId },
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeId);

  return { success: true };
```

- [ ] **Step 4: Rewrite `redoChange` to read/write `ai_events`**

Replace the whole `redoChange` function body (from its `const { data: change, error } = ...` through `return { success: true };`) with:

```ts
  const { data: event, error } = await supabase
    .from("ai_events")
    .select("*")
    .eq("id", changeId)
    .eq("event_type", "agent_change")
    .single();

  if (error || !event) throw new Error("Change not found");
  const change = event.payload as any;
  if (change.status !== "undone") {
    throw new Error(`Cannot redo change with status: ${change.status}`);
  }
  if (!isOwner && event.user_id !== userId) {
    throw new Error("Forbidden: cannot redo another user's change");
  }

  const { target_table, target_id, operation, new_values } = change;

  if (operation === "update") {
    const { error: updateErr } = await supabase
      .from(target_table)
      .update(new_values)
      .eq("id", target_id);
    if (updateErr) throw new Error(`Redo failed: ${updateErr.message}`);
  } else if (operation === "insert") {
    const { error: insertErr } = await supabase
      .from(target_table)
      .insert({ id: target_id, ...new_values });
    if (insertErr) throw new Error(`Redo failed: ${insertErr.message}`);
  } else if (operation === "delete") {
    const { error: deleteErr } = await supabase
      .from(target_table)
      .delete()
      .eq("id", target_id);
    if (deleteErr) throw new Error(`Redo failed: ${deleteErr.message}`);
  }

  await supabase
    .from("ai_events")
    .update({
      payload: { ...change, status: "redone", undone_at: null, undone_by: null },
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeId);

  return { success: true };
```

- [ ] **Step 5: Type-check**

Run: `export PATH="$HOME/.deno/bin:$PATH"; deno check supabase/functions/_shared/aiAgent/executor.ts`
Expected: no errors in `executor.ts` (crypto.ts noise unrelated).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/aiAgent/executor.ts
git commit -m "feat(ai): write/undo/redo agent changes as ai_events"
```

---

## Task 5: Actions function (batch create + `undo_batch`) → `ai_events`

**Files:**
- Modify: `supabase/functions/ai-assistant-actions/index.ts`

- [ ] **Step 1: Repoint the single-action batch insert** (around line 33)

Replace:

```ts
        const { data } = await serviceClient
          .from('ai_agent_batches')
          .insert({
            conversation_id: conversationId,
            user_id: authUserId,
            mode,
            prompt_summary: `${actionType}: ${params?.label || ''}`,
            total_changes: 1,
          })
          .select('id')
          .single();
        batch = data;
```

with:

```ts
        const { data } = await serviceClient
          .from('ai_events')
          .insert({
            event_type: 'agent_batch',
            user_id: authUserId,
            parent_id: conversationId,
            payload: {
              mode,
              prompt_summary: `${actionType}: ${params?.label || ''}`,
              total_changes: 1,
              status: 'applied',
            },
          })
          .select('id')
          .single();
        batch = data;
```

- [ ] **Step 2: Repoint the `undo_batch` owner lookup** (around line 128)

Replace:

```ts
      const { data: batch } = await serviceClient
        .from('ai_agent_batches')
        .select('user_id')
        .eq('id', batchId)
        .single();

      if (!isOwner && batch?.user_id !== authUserId) {
```

with:

```ts
      const { data: batch } = await serviceClient
        .from('ai_events')
        .select('user_id')
        .eq('id', batchId)
        .eq('event_type', 'agent_batch')
        .single();

      if (!isOwner && batch?.user_id !== authUserId) {
```

- [ ] **Step 3: Repoint the `undo_batch` change list** (around line 141)

Replace:

```ts
      const { data: changes } = await serviceClient
        .from('ai_agent_changes')
        .select('id')
        .eq('batch_id', batchId)
        .in('status', ['applied', 'redone'])
        .order('batch_order', { ascending: false });
```

with (changes are children of the batch via `parent_id`; status + order live in `payload`):

```ts
      const { data: changeRows } = await serviceClient
        .from('ai_events')
        .select('id, payload')
        .eq('parent_id', batchId)
        .eq('event_type', 'agent_change');

      const changes = (changeRows || [])
        .filter((c: any) => ['applied', 'redone'].includes(c.payload?.status))
        .sort((a: any, b: any) => (b.payload?.batch_order ?? 0) - (a.payload?.batch_order ?? 0));
```

- [ ] **Step 4: Repoint the batch status update** (around line 159)

Replace:

```ts
      await serviceClient
        .from('ai_agent_batches')
        .update({
          status: undone === (changes?.length || 0) ? 'fully_undone' : 'partially_undone',
        })
        .eq('id', batchId);
```

with (merge the new status into the batch payload; re-read to preserve the other payload fields):

```ts
      const { data: batchEvent } = await serviceClient
        .from('ai_events')
        .select('payload')
        .eq('id', batchId)
        .single();

      await serviceClient
        .from('ai_events')
        .update({
          payload: {
            ...(batchEvent?.payload ?? {}),
            status: undone === (changes?.length || 0) ? 'fully_undone' : 'partially_undone',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchId);
```

- [ ] **Step 5: Type-check**

Run: `export PATH="$HOME/.deno/bin:$PATH"; deno check supabase/functions/ai-assistant-actions/index.ts`
Expected: no errors in this file (crypto.ts noise unrelated).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ai-assistant-actions/index.ts
git commit -m "feat(ai): actions batch + undo_batch over ai_events"
```

---

## Task 6: Frontend conversations + messages → `ai_events`

**Files:**
- Modify: `src/contexts/AIAssistantContext.tsx`

Conversations become `event_type='conversation'` rows (title in `payload`), messages become `event_type='message'` rows whose `parent_id` is the conversation id. The frontend uses the RLS-scoped user client, so each row it inserts must set `user_id` to the current user.

- [ ] **Step 1: Repoint the conversations list query** (the `queryFn` around line 68)

Replace:

```ts
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Conversation[];
```

with (map the title out of `payload`):

```ts
      const { data, error } = await supabase
        .from('ai_events')
        .select('id, user_id, created_at, updated_at, payload')
        .eq('event_type', 'conversation')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        title: row.payload?.title ?? 'New conversation',
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as Conversation[];
```

- [ ] **Step 2: Repoint `createConversation`** (around line 88)

Replace:

```ts
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title: 'New conversation' })
      .select()
      .single();
```

with:

```ts
    const { data, error } = await supabase
      .from('ai_events')
      .insert({ event_type: 'conversation', user_id: user.id, payload: { title: 'New conversation' } })
      .select('id')
      .single();
```

- [ ] **Step 3: Repoint `loadConversation`** (around line 105)

Replace:

```ts
    const { data, error } = await supabase
      .from('ai_conversation_messages')
      .select('role, content')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading conversation:', error);
      return;
    }

    setMessages(data as Message[]);
```

with (pull role/content out of `payload`):

```ts
    const { data, error } = await supabase
      .from('ai_events')
      .select('payload')
      .eq('event_type', 'message')
      .eq('parent_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading conversation:', error);
      return;
    }

    setMessages((data ?? []).map((row: any) => ({
      role: row.payload?.role,
      content: row.payload?.content,
    })) as Message[]);
```

- [ ] **Step 4: Repoint `saveMessages`** (the whole body, around lines 121-160)

Replace the entire `saveMessages` callback body with:

```ts
  const saveMessages = useCallback(async (conversationId: string, newMessages: Message[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Count existing message events for this conversation
    const { count } = await supabase
      .from('ai_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'message')
      .eq('parent_id', conversationId);

    // Only insert new messages
    const messagesToInsert = newMessages.slice(count || 0).map(msg => ({
      event_type: 'message' as const,
      user_id: user.id,
      parent_id: conversationId,
      payload: { role: msg.role, content: msg.content },
    }));

    if (messagesToInsert.length > 0) {
      await supabase.from('ai_events').insert(messagesToInsert);

      // Title the conversation from the first user message on first save
      if (count === 0 && newMessages.length > 0) {
        const firstUserMsg = newMessages.find(m => m.role === 'user');
        if (firstUserMsg) {
          const title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
          await supabase
            .from('ai_events')
            .update({ payload: { title }, updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }
      } else {
        await supabase
          .from('ai_events')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }

      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    }
  }, [queryClient]);
```

- [ ] **Step 5: Repoint `deleteConversation`** (around line 163)

Replace:

```ts
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id);
```

with (deleting the conversation event cascades to its message + batch children via the FK):

```ts
    await supabase
      .from('ai_events')
      .delete()
      .eq('id', id);
```

- [ ] **Step 6: Build the frontend**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/AIAssistantContext.tsx
git commit -m "feat(ai): conversations + messages over ai_events"
```

---

## Task 7: Deploy + verification

**Files:** none (deploy + manual verification)

- [ ] **Step 1: Confirm migration alignment is clean before pushing**

Run: `export PATH="$HOME/.deno/bin:$PATH"; set -a; source .env; set +a; npx supabase migration list -p "$DB_PASSWORD"`
Expected: the new `20260604160000` is the only pending Local-only migration; no Remote-only rows. If a Remote-only row appears (someone applied a migration directly), STOP and reconcile before pushing.

- [ ] **Step 2: Deploy migration + the three edge functions**

Run:
```bash
set -a; source .env; set +a
echo "Y" | npx supabase db push --include-all -p "$DB_PASSWORD"
npx supabase functions deploy ai-assistant-chat ai-assistant-agent ai-assistant-actions
```
Expected: migration `20260604160000` applies; the five old tables are dropped; functions deploy.

- [ ] **Step 3: Verify the schema swap**

In the Supabase SQL editor (or via a read tool): confirm `ai_events` exists and the five old tables are gone:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('ai_events','ai_conversations','ai_conversation_messages',
                     'ai_audit_log','ai_agent_batches','ai_agent_changes');
```
Expected: only `ai_events` is returned.

- [ ] **Step 4: Verify chat history end-to-end**

In the app: open CLX Assistant → start a new chat, send a message, get a reply → reload the page → the conversation appears in history and reopening it shows the messages. Confirms `conversation` + `message` events round-trip.

- [ ] **Step 5: Verify auditing still works**

Ask the assistant a data question (e.g. "how many open deals?") → then check `ai_events`:
```sql
SELECT count(*) FROM public.ai_events WHERE event_type='audit';
```
Expected: count increased — read tools are logging as `audit` events.

- [ ] **Step 6: Verify agent change + undo (if agent/assist mode is reachable in the UI)**

Trigger an agent action that creates/completes a task, then undo it. Confirm the task change applies and reverts, and that:
```sql
SELECT payload->>'status' FROM public.ai_events WHERE event_type='agent_change' ORDER BY created_at DESC LIMIT 1;
```
flips from `applied` to `undone`. If agent mode isn't surfaced in the UI yet, note that and rely on the `deno check` of executor/actions as the guard.

- [ ] **Step 7: Final commit (only if verification required tweaks)**

```bash
git add -A
git commit -m "chore(ai): verification pass for ai_events consolidation"
```

---

## Self-Review Notes

- **Spec coverage:** single `ai_events` table + enum + self-FK + jsonb payload (Task 1) ✓; type mapping for all 5 types (Task 1 INSERTs + Tasks 2-6 writers) ✓; data migration preserving ids (Task 1) ✓; drop old tables (Task 1) ✓; RLS owner policies (Task 1) ✓; audit → events (Task 2) ✓; agent_batch → events (Tasks 3, 5) ✓; agent_change + undo/redo (Task 4) ✓; conversations + messages (Task 6) ✓; deploy + verify (Task 7) ✓.
- **Payload key consistency:** `agent_change` writers (Task 4) emit `target_table`, `target_id`, `operation`, `old_values`, `new_values`, `status`, `batch_order` — exactly the keys the undo/redo reads (Task 4) and the migration backfill (Task 1) use. `agent_batch` writers (Tasks 3, 5) and the migration emit `mode`, `prompt_summary`, `total_changes`, `status`.
- **parent_id semantics:** message→conversation, agent_batch→conversation, agent_change→batch(or conversation), audit→conversation, consistent across migration and runtime writers.
- **RLS vs service role:** edge functions use the service client (RLS bypassed) for audit/batch/change writes; the frontend uses the user client and always sets `user_id = user.id` on conversation/message inserts so the owner policies pass.
- **No placeholders:** every code step shows full replacement text; no TODO/TBD.
