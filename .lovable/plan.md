

## Fix Inbound Calls: Device Registration + Popup Display

### Root Cause (Two Issues)

**Issue 1 - Device not registered when call arrives**: The Twilio Device registers with identity `clx-admin`, but the `<Dial>` in TwiML also targets `clx-admin`. If the browser device isn't registered at the exact moment Twilio tries to deliver the call, the Dial completes in 0-2 seconds and falls through to the "no one is available" voice. Database evidence: all recent calls show 2-5 second durations and `frontend_ack_at: null`.

**Issue 2 - Popup never shows**: Even if the SDK `incoming` event fires, the `device.on('incoming')` handler only sets `activeCall` (the raw SDK Call object). The popup component checks `incomingCall` (populated from the database via realtime subscription). These are two separate state values, and the popup won't show without `incomingCall` being set. There's a race condition where the SDK event and the DB realtime event need to both arrive.

### Changes

**File: `src/contexts/CallContext.tsx`**

1. In the `device.on('incoming')` handler (around line 310), after setting `activeCall`, also create a synthetic `incomingCall` from the SDK Call parameters (From number, CallSid). This ensures the popup shows immediately when the SDK delivers the call, without waiting for the database realtime subscription.

2. Add detailed logging for device registration state changes so we can confirm the device reaches `registered` state.

3. The `initializeTwilioDevice` useCallback has `incomingCall` and `isConnected` in its closure (used inside the `registered` event handler for pending calls). This means the callback gets recreated when these values change, which can cause unnecessary re-initialization. Fix: use refs consistently for these values (already partially done with `incomingCallRef` and `isConnectedRef`).

**File: `src/components/evan/IncomingCallPopup.tsx`**

4. No changes needed -- the popup already checks `incomingCall` and `activeCall`, and once Issue 2 is fixed (setting `incomingCall` from SDK), the popup will appear.

**File: `supabase/functions/twilio-inbound/index.ts`**

5. Remove the `<Say>` AI voice fallback. Replace the voicemail flow with a simple extended ring -- increase timeout further and let the call ring until the caller hangs up, or keep a minimal voicemail without the AI voice message. Based on user preference ("there shouldn't be an AI voice"), the `<Say>` tags will be removed entirely, leaving only `<Record>` with a beep for voicemail if no one answers.

### Technical Details

The key fix in `device.on('incoming')`:

```typescript
device.on('incoming', (call) => {
  setActiveCall(call);
  
  // Create synthetic incomingCall immediately from SDK params
  // so the popup shows without waiting for DB realtime
  const fromNumber = call.parameters.From || 'Unknown';
  const callSid = call.parameters.CallSid || '';
  
  if (!incomingCallRef.current && !isConnectedRef.current) {
    const syntheticCall: ActiveCallData = {
      id: callSid, // temporary ID
      call_sid: callSid,
      from_number: fromNumber,
      to_number: '',
      status: 'ringing',
      direction: 'inbound',
      lead_id: null,
      created_at: new Date().toISOString(),
      leads: null,
    };
    setIncomingCall(syntheticCall);
  }
  
  // ... existing call event handlers
});
```

And in `twilio-inbound/index.ts`, the TwiML becomes:

```xml
<Response>
  <Dial timeout="45" callerId="+19045870026" statusCallback="...">
    <Client>clx-admin</Client>
  </Dial>
  <Record maxLength="120" playBeep="true" />
</Response>
```

No AI voice. If no one answers after 45 seconds, the caller hears a beep and can leave a message, or they can hang up.

