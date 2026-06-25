/**
 * Build a JSON error Response that is safe to return to clients.
 *
 * Logs the full error server-side (visible in `supabase functions logs`) and
 * returns ONLY a generic message to the caller — never `error.message`, stack
 * traces, or upstream API response bodies. This is the single approved way for
 * an edge function to respond to a failure.
 *
 * `clientMessage` lets callers keep a non-sensitive human label (e.g.
 * 'Failed to initiate call') without leaking the underlying detail.
 */
export function errorResponse(
  context: string,
  error: unknown,
  options?: {
    corsHeaders?: Record<string, string>;
    status?: number;
    clientMessage?: string;
  },
): Response {
  const corsHeaders = options?.corsHeaders ?? {};
  const status = options?.status ?? 500;
  const clientMessage = options?.clientMessage ?? 'An unexpected error occurred';
  console.error(`[${context}]`, error);
  return new Response(
    JSON.stringify({ error: clientMessage }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
