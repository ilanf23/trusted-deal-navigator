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
