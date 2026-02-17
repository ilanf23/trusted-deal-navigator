

## Rate Limiting All Edge Functions

### Architecture

A shared in-memory sliding-window rate limiter will be created and imported by every edge function. This is a v1 implementation that protects against burst abuse within each Deno isolate.

### Shared Module

Create `supabase/functions/_shared/rateLimit.ts`:

- Uses an in-memory `Map<string, { count: number; resetAt: number }>` per isolate
- Sliding window: counts requests per IP within a time window
- Auto-cleans expired entries every 60 seconds to prevent memory leaks
- Returns `{ allowed: boolean; remaining: number }` so functions can add headers
- Provides a pre-built 429 response helper

### Rate Limit Tiers

| Tier | Limit | Window | Applied To |
|---|---|---|---|
| Default | 60 req | 60s | Most endpoints |
| Auth-sensitive | 5 req | 60s | `twilio-token`, `admin-update-user` |
| AI endpoints | 10 req | 60s | `ai-email-chat`, `evan-ai-assistant`, `lead-ai-assistant`, `lender-program-assistant` |
| Webhook (external) | 300 req | 60s | `twilio-inbound`, `twilio-call-status`, `twilio-transcription`, `twilio-voice`, `newsletter-track`, `newsletter-webhook` |
| Seed/Admin | 3 req | 60s | `seed-test-data`, `seed-partners` |

Webhook endpoints get a higher limit because they're called by Twilio/email infrastructure servers, not end users.

### IP Extraction

```text
1. Check x-forwarded-for header (first IP in chain)
2. Fallback to x-real-ip
3. Fallback to "unknown"
```

### 429 Response Format

```json
{
  "error": "Too many requests. Please try again later."
}
```

Status code: 429, with `Retry-After` header.

### Implementation Pattern

Every edge function gets this added right after the OPTIONS/CORS check:

```text
import { enforceRateLimit } from "../_shared/rateLimit.ts";

// After OPTIONS check:
const rateLimitResponse = enforceRateLimit(req, "function-name", 60, 60);
if (rateLimitResponse) return rateLimitResponse;

// ... existing business logic
```

### Violation Logging

All rate limit violations are logged to console with:
- Function name
- Client IP
- Timestamp
- Current count vs limit

This enables monitoring via the edge function logs.

### Files to Create

- `supabase/functions/_shared/rateLimit.ts`

### Files to Modify (all 27 edge functions)

1. `supabase/functions/admin-update-user/index.ts` (limit: 3/min)
2. `supabase/functions/ai-email-chat/index.ts` (limit: 10/min)
3. `supabase/functions/call-to-lead-automation/index.ts` (limit: 60/min)
4. `supabase/functions/evan-ai-assistant/index.ts` (limit: 10/min)
5. `supabase/functions/generate-lead-email/index.ts` (limit: 60/min)
6. `supabase/functions/gmail-api/index.ts` (limit: 60/min)
7. `supabase/functions/google-calendar-auth/index.ts` (limit: 60/min)
8. `supabase/functions/google-calendar-sync/index.ts` (limit: 60/min)
9. `supabase/functions/google-sheets-api/index.ts` (limit: 60/min)
10. `supabase/functions/google-sheets-auth/index.ts` (limit: 60/min)
11. `supabase/functions/lead-ai-assistant/index.ts` (limit: 10/min)
12. `supabase/functions/lender-program-assistant/index.ts` (limit: 10/min)
13. `supabase/functions/newsletter-track/index.ts` (limit: 300/min)
14. `supabase/functions/newsletter-webhook/index.ts` (limit: 300/min)
15. `supabase/functions/retry-call-transcription/index.ts` (limit: 60/min)
16. `supabase/functions/seed-partners/index.ts` (limit: 3/min)
17. `supabase/functions/seed-test-data/index.ts` (limit: 3/min)
18. `supabase/functions/send-newsletter/index.ts` (limit: 60/min)
19. `supabase/functions/send-prequalification-email/index.ts` (limit: 60/min)
20. `supabase/functions/slack-notify/index.ts` (limit: 60/min)
21. `supabase/functions/twilio-call-status/index.ts` (limit: 300/min)
22. `supabase/functions/twilio-call/index.ts` (limit: 60/min)
23. `supabase/functions/twilio-inbound/index.ts` (limit: 300/min)
24. `supabase/functions/twilio-sms/index.ts` (limit: 60/min)
25. `supabase/functions/twilio-token/index.ts` (limit: 5/min)
26. `supabase/functions/twilio-transcription/index.ts` (limit: 300/min)
27. `supabase/functions/twilio-voice/index.ts` (limit: 300/min)

### Limitations (v1)

- In-memory state resets on cold starts (acceptable for burst protection)
- Not shared across multiple isolate instances (regional)
- For persistent, cross-instance rate limiting, Upstash Redis can be added as a v2 upgrade

### No Database Changes Required

This implementation is purely in-memory and requires no new tables, migrations, or secrets.
