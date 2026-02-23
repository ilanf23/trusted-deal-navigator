

## Fix: Answer Call Button Stuck on "Connecting..."

### Root Cause

The `answerCall` function (lines 556-672 of `CallContext.tsx`) has a **blocking gate** that prevents the REST API redirect from ever executing:

```
answerCall() 
  -> activeCall is null (SDK never fired 'incoming')
  -> get device ref
  -> WAIT for device.state === 'registered'   <-- BLOCKS HERE (10s timeout)
  -> throw "Device registration timed out"    <-- NEVER REACHES REST API
```

The call_events table confirms this: 4 consecutive `answer_attempted` events all show `device_ready: false`, and the `twilio-connect-call` edge function has zero logs -- it was never called.

### Fix

**File: `src/contexts/CallContext.tsx`** -- Restructure `answerCall` (lines 556-672):

1. **Remove the device registration gate** (lines 580-595). Don't block on device registration before calling the REST API.

2. **Call `twilio-connect-call` immediately** when there's no SDK `activeCall`. The edge function redirects the live Twilio call to re-dial `<Client>clx-admin</Client>`.

3. **Start device initialization in parallel** (non-blocking). While the REST API is redirecting the call, kick off device registration so it's hopefully ready by the time the redirected call arrives.

4. **Keep the 15-second polling wait** for the SDK to pick up the redirected call (lines 624-657), but also attempt device registration during that window.

5. **Improve error messaging**: If the 15s timeout fires, show a clearer message ("Could not connect. Please try answering again or refresh the page.")

### Updated answerCall Flow

```
answerCall()
  -> request mic permission
  -> if activeCall exists: accept directly (no change)
  -> else:
      1. Fire-and-forget: initializeTwilioDevice() (non-blocking)
      2. Immediately call twilio-connect-call REST API
      3. Poll device.calls for 15s waiting for SDK incoming event
      4. If found: accept the call
      5. If timeout: throw clear error
```

### Changes Summary

| File | Change |
|------|--------|
| `src/contexts/CallContext.tsx` | Remove device registration wait gate from `answerCall`; call REST API immediately; init device in parallel |

No edge function changes needed -- `twilio-connect-call` is correct, it just was never being reached.

