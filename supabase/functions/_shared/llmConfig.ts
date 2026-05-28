/**
 * Central LLM configuration for every text/chat edge function.
 *
 * This is the single switch for the model that powers the system. To swap
 * models or providers, change the constants here — every chat/completion call
 * site imports from this module instead of hardcoding its own URL/model/key.
 *
 * Current model: google/gemma-4-31b-it via OpenRouter (OpenAI-compatible wire
 * format, so the existing `messages` / `choices[].message.content` request and
 * response shapes are unchanged).
 *
 * NOTE: Audio transcription (OpenAI Whisper, `whisper-1`) is intentionally NOT
 * routed through here. Whisper is speech-to-text and a chat model cannot
 * replace it — see `transcribeWithWhisper` in _shared/transcription.ts, which
 * still reads OPENAI_API_KEY directly.
 */

/** Provider name for per-user key lookups in the `user_integrations` table. */
export const LLM_PROVIDER = "openrouter";

/** Env var (Supabase secret) holding the system-wide fallback API key. */
export const LLM_API_KEY_ENV = "OPENROUTER_API_KEY";

/** OpenAI-compatible chat-completions endpoint. */
export const LLM_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** The model that powers the system. Change this one line to switch models. */
export const LLM_MODEL = "google/gemma-4-31b-it";

/**
 * Standard request headers for an LLM call. The HTTP-Referer / X-Title fields
 * are OpenRouter attribution headers (optional, ignored by other providers).
 */
export function llmHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://commerciallendingx.com",
    "X-Title": "CommercialLendingX",
  };
}
