

## Fix: Show Incoming Call Popup Even When Twilio Device Isn't Ready

### Root Cause
The `call_events` logs confirm the frontend **did** receive the inbound call via realtime subscription (`event_type: realtime_received`, `socket_connected: true`). However, the Twilio Device was not registered (`device_ready: false`), so the code buffered the call instead of displaying the popup.

The problematic pattern appears in two places in `CallContext.tsx`:

```text
// Realtime handler (line ~527-533):
if (device not registered) {
  buffer the call    <-- BUG: hides the popup
} else {
  show the popup
}

// Polling handler (line ~492-494):
if (device not registered) {
  buffer the call    <-- BUG: hides the popup
}
```

The popup never appears because the Twilio Device WebSocket fails to connect (likely due to iframe restrictions in the preview environment), and buffered calls just sit in memory forever.

### Fix

**`src/contexts/CallContext.tsx`** -- 3 changes:

1. **Realtime handler (line ~527-533)**: Always set `incomingCall` state to show the popup, regardless of device registration. Remove the buffering branch.

2. **Polling / initial fetch (line ~492-499)**: Same change -- always set `incomingCall` instead of buffering when device isn't ready.

3. **Remove `pendingCallsRef` entirely**: Since we no longer buffer calls, the pending calls ref and the "process pending calls on device registered" logic (lines ~258-264) are no longer needed.

The `IncomingCallPopup` already handles the "device not ready" case gracefully -- the Answer button shows "Waiting..." and is disabled when `activeCall` is null. Once the Twilio SDK delivers the `incoming` event (setting `activeCall`), the button becomes active.

### Result
- The popup will appear immediately when a call is detected via realtime or polling
- The Answer button remains disabled until the Twilio SDK is ready (existing behavior)
- If the SDK never connects, the user still sees the call and can decline it
- No changes to edge functions or database needed

