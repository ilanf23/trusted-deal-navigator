

## Fix: Instant Inbound Call Detection

### Problem
When someone calls (904) 587-0026, the call popup takes ~20 seconds to appear. The edge function logs confirm:
- Edge function cold-starts in ~20s before processing begins
- Then `enforceRateLimit` makes a blocking database RPC call (adds ~3s)
- Only THEN does TwiML return to Twilio, which finally dials the browser client

The caller hears silence for 20+ seconds before the browser even knows about the call.

### Root Cause
The `twilio-inbound` edge function has two bottlenecks blocking the critical TwiML response:

1. **Cold start**: Edge functions can take 10-20s to cold-start if they haven't been called recently.
2. **Blocking rate limit**: `enforceRateLimit()` makes a database RPC call BEFORE returning TwiML. This adds 1-3s of latency on every call.

### Solution: Two changes

#### 1. Move rate limiting to background (non-blocking) in `twilio-inbound`

The rate limit check currently blocks the TwiML response. For Twilio webhooks, we should return TwiML as fast as possible and check rate limits in the background. Since Twilio itself is the caller (not an arbitrary user), the risk of abuse is minimal.

**Change in `supabase/functions/twilio-inbound/index.ts`:**
- Remove the blocking `enforceRateLimit()` call from the main request path
- Move it into the `waitUntil()` background work (log it but don't block the response)
- This alone saves 1-3 seconds per call

#### 2. Keep the edge function warm to eliminate cold starts

Add a lightweight health-check ping from the frontend that fires every 5 minutes while an admin is logged in. This keeps the edge function's isolate alive and eliminates cold starts.

**New file: `src/hooks/useEdgeFunctionWarmup.ts`**
- A small hook that runs a `setInterval` every 5 minutes
- Sends an `OPTIONS` preflight request to `twilio-inbound` (zero-cost, just keeps the isolate warm)
- Only runs when the user is an admin (`isAdmin` from AuthContext)
- Mounted in `App.tsx` alongside `CallProvider`

### Technical Details

**`supabase/functions/twilio-inbound/index.ts` changes (lines ~195-198):**

Before:
```typescript
const rateLimitResponse = await enforceRateLimit(req, 'twilio-inbound', 300, 60);
if (rateLimitResponse) return rateLimitResponse;
```

After:
```typescript
// Rate limit in background -- don't block TwiML response for Twilio webhooks
waitUntil(enforceRateLimit(req, 'twilio-inbound', 300, 60).then(resp => {
  if (resp) console.warn('[twilio-inbound] Rate limit would have blocked:', resp.status);
}));
```

**New `src/hooks/useEdgeFunctionWarmup.ts`:**
```typescript
// Pings twilio-inbound every 5 minutes with OPTIONS to prevent cold starts
useEffect(() => {
  if (!isAdmin) return;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-inbound`;
  const ping = () => fetch(url, { method: 'OPTIONS' }).catch(() => {});
  ping(); // immediate warmup on login
  const interval = setInterval(ping, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [isAdmin]);
```

**`src/App.tsx` change:**
- Import and call `useEdgeFunctionWarmup()` inside the app root (next to CallProvider).

### Expected Result
- **Cold start eliminated**: The function stays warm while any admin is online
- **Rate limit no longer blocks**: TwiML returns in <100ms instead of 3-4s
- **Total improvement**: Call popup should appear within 1-2 seconds of the phone ringing (Twilio's own internal routing latency)

