

## Upgrade to Distributed Postgres-Backed Rate Limiting

### Why

The current in-memory `Map`-based rate limiter resets on cold starts and is not shared across edge function isolates. Moving to a Postgres-backed store ensures all instances share the same counters and limits survive restarts.

### Database Migration

Create a `rate_limits` table with a unique constraint for atomic upserts:

```text
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  function_name text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_address, function_name)
);

-- Disable RLS (service-role only access from edge functions)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access

-- Index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (ip_address, function_name);

-- Periodic cleanup: auto-delete expired windows (rows older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '5 minutes';
$$;
```

### Atomic Rate Limit Function (Database-Level)

A Postgres function that handles the check-and-increment atomically using `INSERT ... ON CONFLICT`:

```text
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip text,
  p_func text,
  p_limit int,
  p_window_secs int
)
RETURNS TABLE(allowed boolean, current_count int, retry_after int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_window interval := (p_window_secs || ' seconds')::interval;
BEGIN
  -- Upsert: insert new row or get existing
  INSERT INTO rate_limits (ip_address, function_name, request_count, window_start)
  VALUES (p_ip, p_func, 1, v_now)
  ON CONFLICT (ip_address, function_name)
  DO UPDATE SET
    -- If window expired, reset; otherwise increment
    request_count = CASE
      WHEN rate_limits.window_start + v_window < v_now THEN 1
      ELSE rate_limits.request_count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start + v_window < v_now THEN v_now
      ELSE rate_limits.window_start
    END
  RETURNING * INTO v_row;

  -- Check if over limit
  IF v_row.request_count > p_limit THEN
    RETURN QUERY SELECT
      false,
      v_row.request_count,
      GREATEST(1, EXTRACT(EPOCH FROM (v_row.window_start + v_window - v_now))::int);
  ELSE
    RETURN QUERY SELECT true, v_row.request_count, 0;
  END IF;
END;
$$;
```

This is a single atomic SQL operation -- no race conditions possible.

### New `_shared/rateLimit.ts` (Full Replacement)

Replaces the in-memory implementation entirely. Uses the service-role Supabase client to call the `check_rate_limit` RPC:

```text
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
```

Key design decisions:
- **Fail-open**: If the database is unreachable, the request is allowed through. This prevents the rate limiter itself from becoming a DoS vector.
- **Same signature change**: `enforceRateLimit` becomes `async` and returns `Promise<Response | null>`. Every call site already `await`s within an async handler, so adding `await` is the only caller change needed.

### Caller Change (All 27 Edge Functions)

Every edge function changes from:

```text
const rateLimitResponse = enforceRateLimit(req, "func-name", 60, 60);
```

to:

```text
const rateLimitResponse = await enforceRateLimit(req, "func-name", 60, 60);
```

Since all handlers are already `async`, this is a single-word addition per file. The import path, function name, and parameter order remain identical.

### Cleanup Strategy

Expired rows accumulate in the `rate_limits` table. Two cleanup approaches:

1. **Inline**: The `check_rate_limit` function already resets expired windows on the next request from that IP+function pair.
2. **Periodic**: A `pg_cron` job or manual call to `cleanup_expired_rate_limits()` removes stale rows. This can be set up later. For now the inline reset keeps the table small for active IPs.

### Files to Create

- Database migration: `rate_limits` table, `check_rate_limit` function, `cleanup_expired_rate_limits` function

### Files to Modify

- `supabase/functions/_shared/rateLimit.ts` -- full rewrite (async, Postgres-backed)
- All 27 `supabase/functions/*/index.ts` -- add `await` before `enforceRateLimit()`

### Rate Limit Tiers (Unchanged)

| Tier | Limit | Window | Functions |
|---|---|---|---|
| Seed/Admin | 3/min | 60s | `seed-test-data`, `seed-partners`, `admin-update-user` |
| Auth-sensitive | 5/min | 60s | `twilio-token` |
| AI endpoints | 10/min | 60s | `ai-email-chat`, `evan-ai-assistant`, `lead-ai-assistant`, `lender-program-assistant` |
| Standard | 60/min | 60s | All general-purpose functions |
| Webhook | 300/min | 60s | Twilio webhooks, newsletter webhooks |

### Trade-offs

| Aspect | In-Memory (v1) | Postgres (v2) |
|---|---|---|
| Shared state | No (per isolate) | Yes (all instances) |
| Survives cold starts | No | Yes |
| Latency per request | ~0ms | ~5-15ms (DB round-trip) |
| Race conditions | Possible across isolates | None (atomic upsert) |
| Failure mode | Silent reset | Fail-open (allow through) |

The added latency is acceptable since it's a single indexed upsert query and occurs before the main business logic (which typically involves multiple DB calls or external API calls anyway).

