// Distributed Postgres-backed rate limiter (v2)
// Shared across all edge function isolates via atomic DB upserts.
// Fail-open: if DB is unreachable, requests are allowed through.

import { createClient } from './supabase.ts';

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/**
 * Enforce rate limiting on an incoming request using Postgres-backed atomic counters.
 * Call right after the OPTIONS/CORS check.
 *
 * @param req        - The incoming Request object
 * @param funcName   - Edge function name (for logging + DB key)
 * @param limit      - Max requests allowed in the window
 * @param windowSecs - Window duration in seconds
 * @returns A 429 Response if rate-limited, or null if allowed
 */
export async function enforceRateLimit(
  req: Request,
  funcName: string,
  limit: number,
  windowSecs: number,
): Promise<Response | null> {
  const ip = getClientIp(req);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip: ip,
      p_func: funcName,
      p_limit: limit,
      p_window_secs: windowSecs,
    });

    if (error) {
      console.error('[RATE_LIMIT] DB error, allowing request:', error.message);
      return null; // fail-open on DB errors
    }

    const result = data?.[0];
    if (!result || result.allowed) {
      return null;
    }

    console.warn(
      `[RATE_LIMIT] ${funcName} | IP: ${ip} | ` +
      `${result.current_count}/${limit} in ${windowSecs}s window | blocked`,
    );

    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(result.retry_after),
        },
      },
    );
  } catch (err) {
    console.error('[RATE_LIMIT] Unexpected error, allowing request:', err);
    return null; // fail-open
  }
}
