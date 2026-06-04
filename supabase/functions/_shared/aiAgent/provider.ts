// supabase/functions/_shared/aiAgent/provider.ts
// Vercel AI SDK provider resolution for the AI edge functions.
//
// This builds ON TOP of the existing single switch in `../llmConfig.ts` — it does
// not replace it. DEFAULT_MODEL is seeded from llmConfig so the system keeps
// running on the same provider/model it does today (OpenRouter + gemma).
//
// Model ids are "provider:model" (e.g. "openrouter:google/gemma-4-31b-it"). The
// model segment may itself contain ":" / "/" (OpenRouter ids do), so we split on
// the FIRST ":" only.
//
// Optional providers (openai, anthropic) are imported lazily, so a Deno-incompat
// or missing optional provider can never break the default OpenRouter path.

import { createOpenRouter } from "npm:@openrouter/ai-sdk-provider";
import { LLM_MODEL, LLM_PROVIDER } from "../llmConfig.ts";

export interface ProviderKeys {
  openrouterKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
}

/** Default model in "provider:model" form, from the single switch in llmConfig.ts. */
export const DEFAULT_MODEL = `${LLM_PROVIDER}:${LLM_MODEL}`; // "openrouter:google/gemma-4-31b-it"

/**
 * Resolve a "provider:model" id to an AI SDK LanguageModel using whichever keys
 * are configured. Throws a clear error if the requested provider has no key, so
 * callers can surface a 400.
 */
export async function resolveModel(modelId: string, keys: ProviderKeys) {
  const sep = modelId.indexOf(":");
  const providerId = sep === -1 ? LLM_PROVIDER : modelId.slice(0, sep);
  const model = sep === -1 ? modelId : modelId.slice(sep + 1);

  switch (providerId) {
    case "openrouter": {
      if (!keys.openrouterKey) {
        throw new Error("No API key configured for provider 'openrouter'");
      }
      return createOpenRouter({ apiKey: keys.openrouterKey })(model);
    }
    case "openai": {
      if (!keys.openaiKey) {
        throw new Error("No API key configured for provider 'openai'");
      }
      const { createOpenAI } = await import("npm:@ai-sdk/openai");
      return createOpenAI({ apiKey: keys.openaiKey })(model);
    }
    case "anthropic": {
      if (!keys.anthropicKey) {
        throw new Error("No API key configured for provider 'anthropic'");
      }
      const { createAnthropic } = await import("npm:@ai-sdk/anthropic");
      return createAnthropic({ apiKey: keys.anthropicKey })(model);
    }
    default:
      throw new Error(`Unknown provider '${providerId}'`);
  }
}
