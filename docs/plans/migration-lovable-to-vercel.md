# Migration Plan: Lovable -> Vercel + Personal Supabase

## Context
CommercialLendingX is currently hosted on Lovable with a Lovable-managed Supabase project (`pcwiwtajzqnayfwvqsbh`). The goal is to migrate the frontend hosting to Vercel and switch to a personal Supabase account, while keeping edge functions in Supabase. Three edge functions depend on Lovable's AI gateway which must be replaced with OpenAI API.

---

## Phase 1: Code Cleanup — Remove Lovable Dependencies

### 1.1 Remove `lovable-tagger` from Vite config
- **File:** `vite.config.ts` (line 4, 12)
- Remove `import { componentTagger } from "lovable-tagger"`
- Remove `mode === "development" && componentTagger()` from plugins array

### 1.2 Remove Lovable domain detection
- **File:** `src/components/evan/EvanCalendarWidget.tsx` (lines 59-76)
  - Remove `isEmbeddedLovablePreview()` function and its usage
  - Replace with standard `window.location.origin` for redirect URLs
- **File:** `src/components/gmail/gmailHelpers.ts` (lines 94-96)
  - Remove `.lovableproject.com` detection block
  - Use `window.location.origin` for OAuth callback URL

### 1.3 Replace Lovable AI Gateway with OpenAI API
Three edge functions use `ai.gateway.lovable.dev` — replace with `api.openai.com`:

- **File:** `supabase/functions/lead-ai-assistant/index.ts` (lines 221-304)
  - Change `LOVABLE_API_KEY` -> `OPENAI_API_KEY`
  - Change URL from `https://ai.gateway.lovable.dev/v1/chat/completions` -> `https://api.openai.com/v1/chat/completions`

- **File:** `supabase/functions/generate-lead-email/index.ts` (lines 22-219)
  - Same changes as above

- **File:** `supabase/functions/call-to-lead-automation/index.ts` (lines 24-69)
  - Same changes as above

### 1.4 Update fallback APP_URL
- **File:** `supabase/functions/send-prequalification-email/index.ts` (line 69)
  - Change fallback from `"https://trusted-deal-navigator.lovable.app"` to empty string or remove fallback (require `APP_URL` env var)

### 1.5 Remove Lovable-specific files & dependencies
- Delete `.lovable/` directory
- Remove from `package.json`:
  - `lovable-tagger` (devDependencies)
- Remove Playwright Lovable config (optional, not actively used):
  - `playwright.config.ts` — replace `lovable-agent-playwright-config` import with standard Playwright config
  - `playwright-fixture.ts` — replace with standard Playwright fixture

### 1.6 Update `supabase/config.toml`
- Change `project_id` from `"pcwiwtajzqnayfwvqsbh"` to new Supabase project ID

---

## Phase 2: Create `.env.example`

Create `.env.example` with all required environment variables:

```env
# === FRONTEND (Vercel) ===
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id

# === SUPABASE EDGE FUNCTIONS (set via supabase secrets set) ===

# Supabase (auto-injected in edge functions, but needed for local dev)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_API_KEY_SID=your_api_key_sid
TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_TWIML_APP_SID=your_twiml_app_sid
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_FALLBACK_NUMBER=+1234567890
TWILIO_AUTH_TOKEN=your_auth_token

# OpenAI (replaces LOVABLE_API_KEY)
OPENAI_API_KEY=your_openai_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Dropbox OAuth
DROPBOX_APP_KEY=your_dropbox_app_key
DROPBOX_APP_SECRET=your_dropbox_app_secret

# Email (Resend)
RESEND_API_KEY=your_resend_api_key

# Application
APP_URL=https://your-app.vercel.app

# Team Emails
ILAN_EMAIL=ilan@maverich.ai
ADAM_EMAIL=adam@company.com
```

---

## Phase 3: Vercel Setup

### 3.1 Prepare for Vercel deployment
- Vercel settings:
  - **Framework Preset:** Vite
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
  - **Install Command:** `npm install`
- Create `vercel.json` with SPA rewrite rule:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
  This is critical for React Router — all routes must serve `index.html`.

### 3.2 Set Vercel environment variables
Only 3 frontend env vars needed in Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

---

## Phase 4: New Supabase Project Setup

> These are manual steps performed in Supabase dashboard + CLI

### 4.1 Create new Supabase project
- Create project at https://supabase.com/dashboard
- Note new `project_id`, `URL`, `anon key`, `service_role_key`

### 4.2 Run database migrations
```bash
supabase link --project-ref YOUR_NEW_PROJECT_ID
supabase db push
```
This applies all 89 migrations to the new database.

### 4.3 Migrate data from old project
```bash
# Export from old project (need old DB connection string)
pg_dump -h db.pcwiwtajzqnayfwvqsbh.supabase.co -U postgres -d postgres \
  --data-only --no-owner --no-privileges \
  --exclude-table-data='auth.*' \
  --exclude-table-data='storage.*' \
  --exclude-table-data='supabase_functions.*' \
  --exclude-table-data='supabase_migrations.*' \
  > data_dump.sql

# Import to new project
psql -h db.YOUR_NEW_PROJECT.supabase.co -U postgres -d postgres < data_dump.sql
```

Note: Auth users need to be re-created or exported separately using Supabase's auth admin API.

### 4.4 Set edge function secrets
```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=xxx \
  TWILIO_API_KEY_SID=xxx \
  TWILIO_API_KEY_SECRET=xxx \
  TWILIO_TWIML_APP_SID=xxx \
  TWILIO_PHONE_NUMBER=xxx \
  TWILIO_FALLBACK_NUMBER=xxx \
  TWILIO_AUTH_TOKEN=xxx \
  OPENAI_API_KEY=xxx \
  GOOGLE_CLIENT_ID=xxx \
  GOOGLE_CLIENT_SECRET=xxx \
  DROPBOX_APP_KEY=xxx \
  DROPBOX_APP_SECRET=xxx \
  RESEND_API_KEY=xxx \
  APP_URL=https://your-app.vercel.app \
  ILAN_EMAIL=ilan@maverich.ai \
  ADAM_EMAIL=adam@company.com
```

### 4.5 Deploy edge functions
```bash
supabase functions deploy --no-verify-jwt
```
Or deploy individually for functions that need `verify_jwt = false` (as specified in `config.toml`).

---

## Phase 5: External Service Reconfiguration

### 5.1 Twilio
- Update TwiML App webhook URLs in Twilio Console to point to new Supabase edge function URLs:
  - Voice Request URL: `https://YOUR_NEW_PROJECT.supabase.co/functions/v1/twilio-inbound`
  - Status Callback URL: `https://YOUR_NEW_PROJECT.supabase.co/functions/v1/twilio-call-status`

### 5.2 Google OAuth (Calendar & Sheets)
- In Google Cloud Console, update authorized redirect URIs:
  - Add: `https://YOUR_NEW_PROJECT.supabase.co/functions/v1/google-calendar-auth`
  - Add: `https://YOUR_NEW_PROJECT.supabase.co/functions/v1/google-sheets-auth`
  - Add: `https://your-app.vercel.app` as authorized JavaScript origin

### 5.3 Dropbox OAuth
- In Dropbox App Console, update redirect URIs:
  - Add: `https://YOUR_NEW_PROJECT.supabase.co/functions/v1/dropbox-auth`

### 5.4 Resend
- Verify sending domain if using custom domain

---

## Files Modified (Summary)

| File | Action |
|------|--------|
| `vite.config.ts` | Remove lovable-tagger import & plugin |
| `package.json` | Remove lovable-tagger devDependency |
| `src/components/evan/EvanCalendarWidget.tsx` | Remove Lovable domain detection |
| `src/components/gmail/gmailHelpers.ts` | Remove Lovable domain detection |
| `supabase/functions/lead-ai-assistant/index.ts` | Swap Lovable AI gateway -> OpenAI |
| `supabase/functions/generate-lead-email/index.ts` | Swap Lovable AI gateway -> OpenAI |
| `supabase/functions/call-to-lead-automation/index.ts` | Swap Lovable AI gateway -> OpenAI |
| `supabase/functions/send-prequalification-email/index.ts` | Remove Lovable fallback URL |
| `supabase/config.toml` | Update project_id |
| `vercel.json` | Create (SPA rewrites) |
| `.env.example` | Create (all env vars documented) |
| `.lovable/` | Delete directory |
| `playwright.config.ts` | Remove Lovable import (optional) |
| `playwright-fixture.ts` | Remove Lovable import (optional) |

---

## Verification Checklist

After deployment:
1. `npm run build` succeeds locally without lovable-tagger
2. Vercel deployment succeeds and site loads
3. Auth: sign in / sign up / sign out works
4. Role-based routing: admin, client, partner portals load correctly
5. Twilio: make outbound call, receive inbound call
6. AI features: lead AI assistant responds, email generation works (now via OpenAI)
7. Google Calendar sync works
8. Dropbox integration works
9. Email sending (pre-qualification, newsletter) works
10. All edge functions return 200 (not 401/500)
