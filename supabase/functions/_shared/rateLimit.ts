// In-memory sliding window rate limiter (v1)
// Shared across all edge functions within a single Deno isolate.
// Resets on cold starts — acceptable for burst/brute-force protection.

const store = new Map<string, { count: number; resetAt: number }>();

// Auto-clean expired entries every 60s to prevent memory leaks
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Enforce rate limiting on an incoming request.
 * Call right after the OPTIONS/CORS check.
 *
 * @param req        - The incoming Request object
 * @param funcName   - Edge function name (for logging)
 * @param limit      - Max requests allowed in the window
 * @param windowSecs - Window duration in seconds
 * @returns A 429 Response if rate-limited, or null if allowed
 */
export function enforceRateLimit(
  req: Request,
  funcName: string,
  limit: number,
  windowSecs: number,
): Response | null {
  cleanup();

  const ip = getClientIp(req);
  const key = `${funcName}:${ip}`;
  const now = Date.now();
  const windowMs = windowSecs * 1000;

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // First request or window expired — start fresh
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    console.warn(
      `[RATE_LIMIT] ${funcName} | IP: ${ip} | ${entry.count}/${limit} in ${windowSecs}s window | blocked`,
    );
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  return null;
}
