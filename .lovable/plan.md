

## Fix: Incoming Call Answer Button Disabled ("Waiting...")

### Root Cause

There are **two linked problems**:

1. **Caller hears beep then silence**: The TwiML dials `<Client>clx-admin</Client>` with a 45-second timeout. If the Twilio Device in the browser is not registered at that exact moment, Twilio cannot reach it. The Dial times out and falls through to `<Record playBeep="true" />`, which is the beep the caller hears.

2. **Answer button is faded/disabled**: The popup now appears via database realtime (our last fix), but the Answer button is disabled because it requires `activeCall` -- a Twilio SDK `Call` object that only exists when the SDK fires its `incoming` event. Since the Device isn't registered when Twilio tries to connect, the SDK never fires `incoming`, so `activeCall` stays `null`, and the button stays permanently disabled showing "Waiting...".

```text
Caller dials --> Twilio webhook --> TwiML: Dial <Client>clx-admin</Client>
                                              |
                                              v
                                    Is browser Device registered?
                                    NO --> 45s timeout --> <Record> beep
                                    YES --> SDK fires 'incoming' --> activeCall set --> Answer works
```

The browser Device fails to register reliably in the preview iframe environment, creating a deadlock: popup shows but can never be answered.

### Solution

Create a server-side "answer" mechanism using the **Twilio REST API** so the browser can answer calls without depending on the SDK `incoming` event.

**1. New edge function: `supabase/functions/twilio-connect-call/index.ts`**

When the user clicks "Answer" and there is no SDK `activeCall`, this function:
- Takes the `callSid` from the request
- Uses the Twilio REST API to update the live call with new TwiML that redirects it to a `<Dial><Client>clx-admin</Client></Dial>` (re-attempting the browser connection)
- Uses `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` (both already configured as secrets)
- Follows all edge function standards (CORS, rate limiting, auth verification, generic error responses)

This effectively "re-rings" the browser client, giving the SDK another chance to fire the `incoming` event now that the Device has had time to register.

**2. Update `src/contexts/CallContext.tsx` -- `answerCall` function**

Current flow:
```text
answerCall() --> if no activeCall --> throw error ("Still connecting...")
```

New flow:
```text
answerCall() --> if no activeCall:
  1. Ensure Device is registered (initialize if needed)
  2. Call twilio-connect-call edge function to redirect the call back to browser
  3. Wait briefly for SDK 'incoming' event to fire (setting activeCall)
  4. Accept the call via SDK
```

**3. Update `src/components/evan/IncomingCallPopup.tsx`**

- Remove `!activeCall` from the `disabled` condition on the Answer button
- Change the button text: show "Answer" always (instead of "Waiting...")
- The `answerCall` mutation will handle the connecting logic internally

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/twilio-connect-call/index.ts` | **Create** -- new edge function using Twilio REST API |
| `src/contexts/CallContext.tsx` | **Modify** -- update `answerCall` to use REST API fallback when no SDK `activeCall` |
| `src/components/evan/IncomingCallPopup.tsx` | **Modify** -- enable Answer button regardless of `activeCall` state |

### Technical Details

The `twilio-connect-call` edge function will use the Twilio REST API:

```text
POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Calls/{CallSid}.json
  Url = {supabaseUrl}/functions/v1/twilio-voice?To=client:clx-admin
  Method = POST
```

This redirects the in-progress call to new TwiML that re-dials the browser client. The existing `twilio-voice` function can be extended to handle `client:` prefixed destinations, or the connect function can return TwiML directly.

All required secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) are already configured.

