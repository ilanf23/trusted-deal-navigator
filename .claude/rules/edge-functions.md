---
paths:
  - "supabase/functions/**/*.ts"
---

# Edge Function Conventions

- Every function must call `enforceRateLimit(req, funcName, limit, window)` from `_shared/rateLimit.ts`
- Handle OPTIONS preflight requests before any auth logic
- Set standard CORS headers on all responses (origin: *, standard headers list)
- Admin-only functions must verify JWT and check `user_roles` table for admin/super_admin
- Token refresh for OAuth integrations (Dropbox, Gmail, Sheets, Calendar) must be proactive — refresh when expiry is less than 5 minutes away
- TwiML response functions (twilio-inbound, twilio-voice, twilio-conference) return XML content type, no auth
- Webhook handlers (twilio-call-status, dropbox-webhook, newsletter-webhook) use signature verification, not JWT auth
