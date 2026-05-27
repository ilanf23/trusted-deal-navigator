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
