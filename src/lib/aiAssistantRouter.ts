// Maps an AI assistant request body to the edge function that handles it.
// ai-assistant was split into ai-assistant-chat / ai-assistant-agent / ai-assistant-actions per issue #84.

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
