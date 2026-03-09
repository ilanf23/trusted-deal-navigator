

## Fix: Inbound Call Answering — Conference Bridge Approach

### Root Cause

The current fallback when the SDK doesn't fire `incoming` is circular and broken:

```text
1. Caller → twilio-inbound → <Dial><Client>clx-admin</Client></Dial>
2. SDK doesn't fire "incoming" (iframe sandbox limitation)
3. User clicks Answer → no SDK call object
4. Fallback: twilio-connect-call redirects call to twilio-voice?To=client:clx-admin
5. twilio-voice generates <Dial><Client>clx-admin</Client></Dial> AGAIN
6. SDK still can't receive → caller hears endless ringing beeps
7. Frontend says "connected" optimistically after 8s, but NO audio flows
```

The redirect re-dials the browser client the same way that already failed. The caller hears ringing forever and there's never actual audio.

### Solution: Twilio Conference Bridge

Instead of re-dialing the browser, use a **Conference room** as a bridge. When the user clicks Answer:

1. Redirect the inbound call into a named Conference room (caller joins, hears hold music briefly)
2. Browser makes an **outbound** `Device.connect()` to join the same Conference
3. Both parties are bridged — audio flows

Outbound `Device.connect()` works reliably because it doesn't require receiving an `incoming` event — it initiates from the browser side.

### Changes

**1. New edge function: `supabase/functions/twilio-conference/index.ts`**
- Accepts a `conference` name parameter
- Returns TwiML: `<Response><Dial><Conference>{name}</Conference></Dial></Response>`
- Used by both the redirected inbound call AND the browser's outbound connection

**2. Modify `supabase/functions/twilio-connect-call/index.ts`**
- Generate a unique conference room name (e.g., `call-bridge-{callSid}`)
- Redirect the inbound call to `twilio-conference?conference={name}` instead of `twilio-voice?To=client:clx-admin`
- Return the conference name in the response so the frontend knows which room to join

**3. Modify `supabase/functions/twilio-voice/index.ts`**
- Add handling for `conference:` prefix in the `To` parameter
- When `To=conference:{name}`, return `<Conference>{name}</Conference>` TwiML
- This lets the browser's `Device.connect({ params: { To: 'conference:{name}' } })` join the same room

**4. Modify `src/contexts/CallContext.tsx` — `answerCall` fallback path**
- After `twilio-connect-call` succeeds and returns the conference name:
  - Ensure device is initialized (parallel init already in place)
  - Call `device.connect({ params: { To: 'conference:{conferenceName}' } })` to join the conference
  - Wire up the returned Call object's events (`accept`, `disconnect`) normally
  - Remove the broken "poll for SDK incoming event" logic
  - Remove the optimistic connection (real audio will flow through the conference)

### Technical Details

```text
BEFORE (broken):
  Caller ──→ twilio-inbound ──→ <Dial><Client>clx-admin</Client>
                                       ↓ (SDK fails)
  Answer click ──→ twilio-connect-call ──→ redirect to twilio-voice
                                              ↓
                                         <Dial><Client>clx-admin</Client> (fails again)

AFTER (conference bridge):
  Caller ──→ twilio-inbound ──→ <Dial><Client>clx-admin</Client>
                                       ↓ (SDK fails)
  Answer click ──→ twilio-connect-call ──→ redirect caller into Conference "bridge-{sid}"
                   ↓ (returns conference name)
  Browser ──→ Device.connect({ To: "conference:bridge-{sid}" }) ──→ joins same Conference
                   ↓
  Both parties bridged — audio flows ✓
```

The Conference approach is the standard Twilio pattern for connecting two legs that can't directly dial each other. `Device.connect()` for outbound always works because the browser initiates it — no dependency on receiving an `incoming` event.

