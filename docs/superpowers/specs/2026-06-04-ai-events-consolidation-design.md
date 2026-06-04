# Consolidate AI Tables into a Single `ai_events` Table (Design Spec)

**Date:** 2026-06-04
**Author:** Ilan + Kin
**Status:** Approved design, pending implementation plan

## Problem / Goal

The AI assistant's state is spread across five tables: `ai_conversations`,
`ai_conversation_messages`, `ai_audit_log`, `ai_agent_batches`, and
`ai_agent_changes`. The user wants these collapsed into **one physical table**.

This was chosen with full awareness of the trade-offs (loss of per-type foreign
keys, mixed hot/cold data, nullable/jsonb sprawl, more app-level branching). The
design below contains those downsides as much as possible: relationships are
preserved via a self-referencing `parent_id`, and all type-specific fields live
in a single `payload` jsonb column rather than a wide sea of nullable columns.

## Approved Decisions

- **One table**, `ai_events`, replaces all five.
- **Type discriminator**: a Postgres enum `ai_event_type`.
- **Relationships**: a self-referencing `parent_id` with `ON DELETE CASCADE`.
- **Type-specific data**: a single `payload jsonb` column (not promoted columns).
- **Data**: migrate existing rows from all five tables, then drop them
  (pre-production with fake data — low risk, but migrate for safety).

## Schema

```sql
CREATE TYPE public.ai_event_type AS ENUM
  ('conversation', 'message', 'audit', 'agent_batch', 'agent_change');

CREATE TABLE public.ai_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  public.ai_event_type NOT NULL,
  user_id     uuid,                                  -- actor; nullable for system/sentinel audit rows
  parent_id   uuid REFERENCES public.ai_events(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX ai_events_type_idx        ON public.ai_events (event_type);
CREATE INDEX ai_events_parent_idx      ON public.ai_events (parent_id);
CREATE INDEX ai_events_user_created_idx ON public.ai_events (user_id, created_at DESC);
CREATE INDEX ai_events_payload_idx     ON public.ai_events USING gin (payload);
```

Notes:
- `user_id` is intentionally **not** FK-constrained to `auth.users` so the
  audit sentinel UUID path (used when a failure happens before the JWT
  resolves) keeps working, matching today's `ai_audit_log` behaviour.
- `parent_id` self-cascade means deleting a `conversation` row removes its
  `message` and `agent_batch` children; deleting an `agent_batch` removes its
  `agent_change` children.

## Type Mapping

| `event_type` | `parent_id` | `payload` keys (from the old columns) |
|---|---|---|
| `conversation` | null | `title` |
| `message` | its conversation event | `role`, `content` |
| `audit` | its conversation event (nullable) | `function_name`, `tool`, `scope`, `record_ids`, `mode`, `success`, `error_message` |
| `agent_batch` | its conversation event (nullable) | `mode`, `prompt_summary`, `total_changes`, `status` |
| `agent_change` | its batch event (else its conversation, else null) | `conversation_id`, `team_member_id`, `mode`, `target_table`, `target_id`, `operation`, `old_values`, `new_values`, `description`, `ai_reasoning`, `status`, `undone_at`, `undone_by`, `batch_order`, `model_used` |

- `created_at` is taken from each source's timestamp (`occurred_at` for audit,
  `created_at` for the rest). `updated_at` defaults to `created_at` on migration.
- The stale `team_members(id)` FK on `ai_agent_changes` is **not** recreated —
  `team_member_id` becomes a plain value inside `payload`.

## Common Query Patterns (after migration)

- **Render a chat thread**: `SELECT … FROM ai_events WHERE event_type='message'
  AND parent_id = :conversationId ORDER BY created_at`.
- **List a user's conversations**: `event_type='conversation' AND user_id = :uid
  ORDER BY created_at DESC` (or `updated_at`).
- **Write an audit row**: insert `event_type='audit'` with the audit fields in
  `payload`.
- **Undo/redo a change**: `UPDATE ai_events SET payload = payload ||
  '{"status":"undone"}', updated_at = now() WHERE id = :changeId AND
  event_type='agent_change'`.
- **A batch's changes**: `event_type='agent_change' AND parent_id = :batchId
  ORDER BY (payload->>'batch_order')::int`.

## Refactor Surface

All code that touches the five tables must move to `ai_events` in the same change
or chat/undo break:

1. **Migration** — create enum + `ai_events` + indexes + RLS; migrate rows from
   all five tables (preserving ids so existing `parent_id`/`conversation_id`
   links resolve); drop the five old tables.
2. **`supabase/functions/_shared/aiAgent/audit.ts`** — insert `audit` events.
3. **`supabase/functions/ai-assistant-agent/index.ts`** — create/update
   `agent_batch` events (`total_changes`).
4. **`supabase/functions/ai-assistant-actions/index.ts` +
   `_shared/aiAgent/executor.ts`** — insert `agent_change` events; undo/redo
   updates `payload.status`/`undone_at`/`undone_by`.
5. **Frontend `src/contexts/AIAssistantContext.tsx`** — create/load/save/delete
   `conversation` and `message` events (drives the chat UI; largest single
   change).

## RLS

`ai_events` gets row-level security mirroring today's intent: a user can read/write
their own rows (`user_id = auth.uid()`); the service role (used by edge functions)
bypasses RLS for audit/agent writes, exactly as now. Conversation/message reads
in the frontend are scoped to the owner.

## Out of Scope

- No change to *what* data is captured — only where it is stored.
- No change to the database-query assistant's read tools or allowlist.
- No new AI features.

## Implementation Order

1. Migration: enum + `ai_events` + indexes + RLS + data migration + drop old tables.
2. `audit.ts` → `ai_events`.
3. `ai-assistant-agent` → `ai_events` (batches).
4. `ai-assistant-actions` + `executor.ts` → `ai_events` (changes + undo/redo).
5. `AIAssistantContext.tsx` → `ai_events` (conversations + messages).
6. `npm run deploy` + frontend build + manual verification (chat history, agent
   change + undo).

## Success Criteria

- Only `ai_events` remains; the five old tables are gone.
- Chat threads still load, save, and delete correctly.
- The audit log still records every read tool/SQL call (as `audit` events).
- Agent-mode changes still apply, and undo/redo still works (as `agent_change`
  events with mutated `payload.status`).
- Existing conversations/messages survive the migration (ids preserved).
