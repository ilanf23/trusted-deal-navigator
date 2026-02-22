
## Fix Broken Edge Functions and Call System Sync

### Root Cause
Three edge functions had their helper functions deleted and replaced with `// ... keep existing code` comments. This causes `ReferenceError` crashes at runtime:

- **`twilio-inbound/index.ts`** (line 11): Missing `waitUntil`, `escapeXml`, `parseCsvEnv`, `buildInboundTwiML`, `getSlackConfig`, `sendSlackAlert`, `ProviderBoundaryLog` type, `persistProviderBoundaryLog`, `maybeAlertInboundRoutingBroken`, `generateFlowId`
- **`twilio-call-status/index.ts`** (line 10): Missing `okTwiML`, `addSpeakerLabels`, `transcribeAudio`

### Plan

**1. Restore `twilio-call-status/index.ts` helper functions**

Add back the three missing functions before the `Deno.serve()` handler:

- `okTwiML()` -- returns a minimal valid TwiML `<Response/>` so Twilio always gets a proper reply
- `addSpeakerLabels(text, direction)` -- formats raw transcript with "Evan:" / "Caller:" speaker labels based on call direction
- `transcribeAudio(url, direction)` -- calls the OpenAI Whisper API (`/v1/audio/transcriptions`) to transcribe an MP3 recording URL, then applies speaker labels; returns null on failure so the flow continues gracefully

**2. Restore `twilio-inbound/index.ts` helper functions**

Add back all missing functions and types before the `Deno.serve()` handler:

- `waitUntil(promise)` -- fire-and-forget pattern for background work (DB writes, alerts) that must not block the TwiML response
- `escapeXml(str)` -- escapes `<>&'"` characters for safe embedding in TwiML XML
- `parseCsvEnv(key)` -- reads a comma-separated env var into a string array (used for client identities)
- `buildInboundTwiML(options)` -- generates TwiML XML that plays a hold message then dials all configured Twilio Client identities with status callbacks
- `getSlackConfig()` -- reads Slack env vars (token, channel) for alerting
- `sendSlackAlert(config, message)` -- posts a message to the configured Slack channel via the Slack Web API
- `ProviderBoundaryLog` interface -- TypeScript type for the structured boundary log
- `persistProviderBoundaryLog(log)` -- inserts a boundary log row into `call_events` table for debugging/monitoring
- `maybeAlertInboundRoutingBroken(log)` -- checks if the TwiML response looks malformed/empty and sends a Slack alert if so
- `generateFlowId()` -- returns a `crypto.randomUUID()` for correlating all events in a single call flow

**3. Deploy both edge functions**

Deploy `twilio-call-status` and `twilio-inbound` to replace the broken versions.

### What this fixes
- Inbound calls will no longer crash the webhook, so Twilio will stop returning 500 errors
- Call status callbacks will properly update `active_calls` and `evan_communications` tables
- The "Syncing call system..." banner should clear once the device successfully registers (assuming the TwiML App Voice URL is correctly configured in Twilio Console)

### Reminder about TwiML App Voice URL
The device registration depends on the TwiML App (SID `AP5129...029e`) having its Voice Request URL set to:
```text
https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/twilio-voice
```
This is a Twilio Console setting that cannot be changed from code. If the URL is wrong, the device will register but outbound calls will get 3100 errors.

### Files changed
- `supabase/functions/twilio-call-status/index.ts` -- restore 3 helper functions
- `supabase/functions/twilio-inbound/index.ts` -- restore 10 helper functions/types
