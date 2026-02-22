

## Fix: Inbound Call Routing with Fallback -- No More Instant Hangups

### Root Cause

The current TwiML dials only a Twilio **Client** identity (`evan-admin`). If Evan's browser-based phone isn't registered (he's not logged in, device lost connection, tab closed, etc.), Twilio sees "no endpoint available" and the `<Dial>` completes **instantly** (0-2 seconds). The call then falls through to the `<Say>Sorry, no one is available...` and hangs up.

Database evidence: recent calls show `created_at` to `ended_at` gaps of only 2 seconds -- confirming the Dial isn't actually ringing anything.

### Fix Summary

1. **Add a backup phone number** inside the `<Dial>` alongside the Client identity. Twilio will ring **both simultaneously** -- if the browser client isn't registered, the physical phone still rings for the full timeout.
2. **Increase ring timeout** from 30 to 45 seconds to give more time to answer.
3. **Improve voicemail fallback** -- if neither answers after 45 seconds, play a professional message and record voicemail (this part already exists but never triggers because the Dial completes instantly).
4. **Add a new environment variable** `TWILIO_FALLBACK_NUMBER` for the backup phone number to ring.
5. **Add enhanced structured logging** for call outcomes (answered vs voicemail vs failed) per the compliance requirements.

### What Changes

**File: `supabase/functions/twilio-inbound/index.ts`**

- Add `TWILIO_FALLBACK_NUMBER` env var reading
- Modify `buildInboundTwiML` to include both `<Client>` and `<Number>` tags inside `<Dial>` -- Twilio rings them simultaneously
- Increase default timeout to 45 seconds
- Add `callerId` attribute on `<Dial>` so the backup phone shows the company number
- Add structured logging for the routing decision (which endpoints were dialed, whether fallback number was configured)
- Add Slack alert if a call goes to voicemail (no one answered)

**New secret: `TWILIO_FALLBACK_NUMBER`**

You'll need to provide a backup phone number (e.g., Evan's cell phone) that will ring alongside the browser client.

### Call Flow After Fix

```text
Caller dials (904) 587-0026
        |
        v
twilio-inbound webhook returns TwiML
        |
        v
<Dial timeout="45">
  <Client>evan-admin</Client>      <-- browser phone
  <Number>+1XXXXXXXXXX</Number>    <-- backup cell phone
</Dial>
  (rings BOTH for up to 45 seconds)
        |
        v
If answered --> call connected, recorded
If no answer after 45s --> voicemail fallback
  <Say>Sorry, no one is available... leave a message</Say>
  <Record maxLength="120" />
  <Say>Thank you. Goodbye.</Say>
```

### No Scenario Ends in Immediate Hangup

- Client registered + answers --> connected
- Client registered + no answer, backup answers --> connected
- Client not registered, backup answers --> connected
- Neither answers after 45s --> voicemail recorded
- Function error --> Twilio uses its own fallback (no `<Reject>` or `<Hangup>` in any code path)

### Technical Details

- The `<Dial>` verb with both `<Client>` and `<Number>` children rings all endpoints simultaneously (Twilio's fork-dial behavior)
- `record="record-from-answer-dual"` captures both sides once answered
- `statusCallback` continues to fire events for logging
- The `TWILIO_PHONE_NUMBER` env var (already set) is used as `callerId` on the backup number leg
- No frontend changes required

