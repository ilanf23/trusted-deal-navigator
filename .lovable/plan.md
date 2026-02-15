

## Fix: Hundreds of `active_calls` Requests Per Minute

### Root Cause

The `useEffect` in `CallContext.tsx` (line 390) that sets up the polling interval and realtime subscription has **unstable dependencies**:

```
[isEvan, incomingCall, isConnected, queryClient, acknowledgeCall, logCallEvent, initializeTwilioDevice]
```

- `incomingCall` and `isConnected` are state values that change frequently
- `acknowledgeCall`, `logCallEvent`, `initializeTwilioDevice` are likely recreated on every render (not wrapped in `useCallback` with stable deps)

Every time any of these changes, the effect tears down and re-creates a new 2-second `setInterval` **plus** a new realtime channel subscription. During the brief window between teardown and setup, overlapping requests stack up. This creates a cascade of hundreds of fetches.

Additionally, `EvansCalls.tsx` has its own independent 2-second poll (`refetchInterval: 2000`), doubling the traffic.

### Fix Plan

#### 1. Stabilize the polling effect in `CallContext.tsx`

- Move `incomingCall`, `isConnected`, and the callback functions into `useRef` values so the effect doesn't re-run when they change
- The effect dependency array should only contain `[isEvan]` -- it should set up once when Evan logs in and tear down when they leave
- Inside `fetchRingingCalls` and the realtime handler, read current values from refs instead of closures

#### 2. Remove the redundant poll in `EvansCalls.tsx`

- Change `refetchInterval: 2000` to either remove it entirely (rely on realtime invalidation from `CallContext`) or increase it to 30 seconds as a fallback
- The realtime subscription in `CallContext` already calls `queryClient.invalidateQueries({ queryKey: ['evan-active-calls'] })` (after adding the correct key), so the query will refresh on actual changes

#### 3. Add missing query key to realtime invalidation

- Line 473 invalidates `['active-calls-ringing']` but EvansCalls uses `['evan-active-calls']` -- add invalidation for the correct key so the page updates from realtime events

### Technical Details

**File: `src/contexts/CallContext.tsx`**

Add refs to track mutable state:
```typescript
const incomingCallRef = useRef(incomingCall);
const isConnectedRef = useRef(isConnected);
useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);
```

Ensure `acknowledgeCall`, `logCallEvent`, `initializeTwilioDevice` are wrapped in `useCallback` with stable dependencies (or also accessed via refs).

Simplify the effect dependency array:
```typescript
useEffect(() => {
  if (!isEvan) return;
  
  const fetchRingingCalls = async () => {
    // Use incomingCallRef.current and isConnectedRef.current
    // instead of closure variables
  };
  
  fetchRingingCalls();
  const pollInterval = setInterval(fetchRingingCalls, 5000); // Also increase to 5s
  
  const channel = supabase.channel('active-calls-realtime-context')
    .on('postgres_changes', { ... }, (payload) => {
      // Use refs for incomingCall/isConnected checks
    })
    .subscribe();

  return () => {
    clearInterval(pollInterval);
    supabase.removeChannel(channel);
  };
}, [isEvan]); // Stable dependency -- only re-run when Evan status changes
```

**File: `src/pages/admin/EvansCalls.tsx`**

Change line 216:
```typescript
// Before
refetchInterval: 2000,

// After
refetchInterval: 30000, // Fallback only; realtime handles live updates
```

**File: `src/contexts/CallContext.tsx`** (line 473)

Add the correct query key invalidation:
```typescript
queryClient.invalidateQueries({ queryKey: ['evan-active-calls'] });
```

### Expected Result

- Polling drops from hundreds/second to ~1 request every 5 seconds (stable interval)
- Realtime subscription is created once, not repeatedly torn down
- EvansCalls page relies on realtime pushes instead of aggressive polling
- No functional change to call detection -- calls still appear instantly via realtime

