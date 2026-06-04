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
  } catch (e) {
    // Audit failures must never break the assistant. Log and move on.
    console.error('ai_audit_log insert failed:', e);
  }
}
