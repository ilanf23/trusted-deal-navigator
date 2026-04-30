# Supabase Edge Functions

33 Deno TypeScript edge functions + shared utilities. All deployed as Supabase Edge Functions.

## Shared Patterns (_shared/)

**`rateLimit.ts`** — Postgres-backed rate limiting via `check_rate_limit` stored procedure. Fail-open design. Returns 429 with Retry-After header. Limits range from 3/60s to 300/60s.

**`constants.ts`** — Environment config (`ILAN_EMAIL` default).

**All functions share:**
- CORS headers (`*` origin, standard headers)
- Rate limiting via `enforceRateLimit(req, funcName, limit, window)`
- OPTIONS preflight handling
- Consistent error response format

## Auth Patterns
1. **JWT Bearer Token** — most admin/user functions (verify via Supabase client)
2. **Service Role** — internal/background operations (dropbox-sync, google-sheets-sync, etc.)
3. **Webhook Callbacks** — no auth, signature verification instead (dropbox-webhook, twilio-call-status)
4. **TwiML Responders** — no auth, Twilio-only endpoints (twilio-inbound, twilio-voice, twilio-conference)

## Functions by Category

### Admin & User Management
- `admin-update-user` — admin-only email/password update (3/60s)
- `manage-user-role` — manage roles: admin, super_admin, client, partner (3/60s)

### AI Assistants
- `ai-assistant` — merged assistant + agent executor. Uses OpenAI. Resolves the calling team member from the JWT.
- `lead-ai-assistant` — lead-specific assistant with activity context (10/60s)
- `ai-email-chat` — AI email chat for leads. Builds lead context from questionnaire/rate_watch data (10/60s)
- `lender-program-assistant` — match leads to lender programs via OpenAI (10/60s)

### Twilio Voice & SMS (8 functions)
- `twilio-token` — generate browser client tokens (HS256 JWT, 1h expiry, 5/60s)
- `twilio-call` — initiate outbound calls (admin required, 60/60s)
- `twilio-voice` — TwiML for outbound calls + conference joins (300/60s)
- `twilio-inbound` — TwiML for inbound: dials browser client + fallback phone + voicemail (no auth)
- `twilio-conference` — TwiML for conference room joining (300/60s)
- `twilio-connect-call` — redirect live calls to conference bridges (admin, 10/60s)
- `twilio-call-status` — webhook: call completion + OpenAI Whisper transcription
- `twilio-sms` — send SMS (admin, 60/60s)
- `twilio-transcription` — webhook: handle Twilio transcription callbacks (300/60s)
- `retry-call-transcription` — retry failed transcriptions via Whisper

### Gmail & Email
- `gmail-auth` — OAuth callback, get-oauth-url, status, disconnect (30/60s). Issues #84 split.
- `gmail-mailbox` — Read ops: list, get, get-attachment, list-drafts-count, labels (120/60s). Issue #84 split.
- `gmail-write` — Mutations: send, archive, trash, mark-read, create-draft (60/60s). Issue #84 split.
- Shared helpers in `_shared/gmail/api.ts` (token validation, MIME builders, message ops).
- `generate-lead-email` — AI-generated contextual emails for leads (60/60s)
- `call-to-lead-automation` — automate lead follow-up after calls (email drafts via Resend/Gmail)
- `send-prequalification-email` — send questionnaire emails with unique token URLs (60/60s)

### Newsletter
- `send-newsletter` — bulk send via Resend with click/open tracking pixel injection (60/60s)
- `newsletter-track` — tracking pixel + link redirect. Bot detection for accurate metrics (300/60s)
- `newsletter-webhook` — Resend webhook events (delivered, opened, clicked, bounced, complained, unsubscribed). Svix HMAC-SHA256 signature verified via `_shared/svixSignature.ts` against `RESEND_WEBHOOK_SECRET`; 5-min replay window (300/60s)

### Dropbox (4 functions)
- `dropbox-auth` — OAuth flow, token storage in `dropbox_connections` (60/60s)
- `dropbox-api` — generic API wrapper with proactive token refresh (5-min buffer)
- `dropbox-sync` — incremental cursor-based sync with text extraction (50K char limit)
- `dropbox-webhook` — HMAC-SHA256 verified webhook, triggers sync

### Google Workspace (4 functions)
- `google-sheets-auth` — OAuth flow for Sheets (60/60s)
- `google-sheets-api` — Sheets API wrapper with 23-field column mapping (60/60s)
- `google-sheets-sync` — bidirectional lead data sync
- `google-calendar-auth` — OAuth flow for Calendar (60/60s)
- `google-calendar-sync` — sync appointments to Calendar (America/New_York timezone)

## External API Integrations
- **Twilio**: Voice, SMS, conferencing, recording, transcription
- **OpenAI**: GPT (chat/email), Whisper (transcription)
- **Google**: OAuth2, Calendar, Sheets, Gmail
- **Dropbox**: OAuth2, file sync, webhooks
- **Resend**: Email sending, webhook events
