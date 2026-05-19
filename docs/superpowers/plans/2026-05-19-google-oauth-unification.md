# Google OAuth Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify three separate Google OAuth integrations (Calendar, Sheets, Gmail) into a single connection per user — one DB table, one auth edge function, one token-refresh utility.

**Architecture:** Replace `calendar_connections`, `gmail_connections`, and `sheets_connections` tables with a single `google_connections` table. Replace 3 auth edge functions with one `google-auth` function. Consolidate 5 duplicate token-refresh implementations into one shared `_shared/googleToken.ts`. Update all consumers (edge functions, hooks, components, callback pages, routes).

**Tech Stack:** Supabase (Postgres migrations, Deno edge functions), React + TypeScript, TanStack Query

**Spec:** `docs/superpowers/specs/2026-05-19-google-oauth-unification-design.md`

---

## File Structure

### New files
- `supabase/migrations/20260519120000_create_google_connections.sql` — Migration 1: create + backfill
- `supabase/migrations/20260519120001_drop_old_google_tables.sql` — Migration 2: drop old tables
- `supabase/functions/_shared/googleToken.ts` — Shared token refresh utility
- `supabase/functions/google-auth/index.ts` — Unified OAuth edge function
- `src/pages/admin/GoogleCallback.tsx` — Unified OAuth callback page

### Files to modify
- `supabase/functions/google-calendar-sync/index.ts` — Remove inline token refresh, use shared, change table
- `supabase/functions/google-sheets-sync/index.ts` — Remove inline token refresh, use shared, change table
- `supabase/functions/google-sheets-api/index.ts` — Remove inline token refresh, use shared, change table
- `supabase/functions/_shared/gmail/api.ts` — Use new shared token utility
- `supabase/functions/sheets-watch-start/index.ts` — Use new shared utility, change table
- `supabase/functions/sheets-watch-stop/index.ts` — Use new shared utility, change table
- `supabase/functions/sheets-watch-webhook/index.ts` — Change table reference
- `src/hooks/useCalendarData.ts` — Call `google-auth`, update localStorage/callback
- `src/hooks/useGoogleSheets.ts` — Call `google-auth`, update callback
- `src/hooks/useGmailConnection.ts` — Call `google-auth`, change table
- `src/components/gmail/gmailHelpers.ts` — Update callback URL helper
- `src/components/admin/LeadDetailDialog.tsx` — Change `gmail_connections` to `google_connections`
- `src/components/admin/PipelineExpandedView.tsx` — Change `gmail_connections` to `google_connections`
- `src/components/admin/UnderwritingExpandedView.tsx` — Change `gmail_connections` to `google_connections`
- `src/components/admin/LenderManagementExpandedView.tsx` — Change `gmail_connections` to `google_connections`
- `src/components/admin/LenderExpandedView.tsx` — Change `gmail_connections` to `google_connections`
- `src/components/admin/ProjectDetailPanel.tsx` — Change `gmail_connections` to `google_connections`
- `src/components/admin/settings/IntegrationsSection.tsx` — Change `gmail_connections` to `google_connections`
- `src/App.tsx` — Swap callback routes

### Files to delete
- `supabase/functions/google-calendar-auth/index.ts`
- `supabase/functions/google-sheets-auth/index.ts`
- `supabase/functions/gmail-auth/index.ts`
- `supabase/functions/_shared/googleTokenRefresh.ts`
- `supabase/functions/_shared/gmailToken.ts`
- `src/pages/admin/CalendarCallback.tsx`
- `src/pages/admin/SheetsCallback.tsx`
- `src/pages/admin/InboxCallback.tsx`

---

### Task 1: Create database migration — new `google_connections` table

**Files:**
- Create: `supabase/migrations/20260519120000_create_google_connections.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Create unified google_connections table
CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email CHARACTER VARYING NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT,
  calendar_id TEXT,
  drive_watch_channel_id TEXT,
  drive_watch_channel_token TEXT,
  drive_watch_resource_id TEXT,
  drive_watch_expiry TIMESTAMP WITH TIME ZONE,
  drive_watch_spreadsheet_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for drive watch webhook lookups
CREATE INDEX IF NOT EXISTS idx_google_connections_drive_watch_channel_id
  ON public.google_connections (drive_watch_channel_id)
  WHERE drive_watch_channel_id IS NOT NULL;

-- RLS
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own google connection"
  ON public.google_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on google_connections"
  ON public.google_connections
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Backfill from existing tables.
-- For each user_id, take the row with the most recent updated_at across all 3 tables
-- for token data, and merge provider-specific columns.
INSERT INTO public.google_connections (
  user_id, email, access_token, refresh_token, token_expiry,
  scopes, calendar_id,
  drive_watch_channel_id, drive_watch_channel_token,
  drive_watch_resource_id, drive_watch_expiry, drive_watch_spreadsheet_id,
  created_at, updated_at
)
SELECT
  all_users.user_id,
  COALESCE(best.email, ''),
  COALESCE(best.access_token, ''),
  COALESCE(best.refresh_token, ''),
  COALESCE(best.token_expiry, now()),
  'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email profile',
  cal.calendar_id,
  sh.drive_watch_channel_id,
  sh.drive_watch_channel_token,
  sh.drive_watch_resource_id,
  sh.drive_watch_expiry,
  sh.drive_watch_spreadsheet_id,
  LEAST(
    COALESCE(cal.created_at, 'infinity'),
    COALESCE(gm.created_at, 'infinity'),
    COALESCE(sh.created_at, 'infinity')
  ),
  GREATEST(
    COALESCE(cal.updated_at, '-infinity'),
    COALESCE(gm.updated_at, '-infinity'),
    COALESCE(sh.updated_at, '-infinity')
  )
FROM (
  SELECT user_id FROM public.calendar_connections
  UNION
  SELECT user_id FROM public.gmail_connections
  UNION
  SELECT user_id FROM public.sheets_connections
) all_users
LEFT JOIN public.calendar_connections cal ON cal.user_id = all_users.user_id
LEFT JOIN public.gmail_connections gm ON gm.user_id = all_users.user_id
LEFT JOIN public.sheets_connections sh ON sh.user_id = all_users.user_id
CROSS JOIN LATERAL (
  SELECT email, access_token, refresh_token, token_expiry
  FROM (
    SELECT email, access_token, refresh_token, token_expiry, updated_at
    FROM public.calendar_connections WHERE user_id = all_users.user_id
    UNION ALL
    SELECT email, access_token, refresh_token, token_expiry, updated_at
    FROM public.gmail_connections WHERE user_id = all_users.user_id
    UNION ALL
    SELECT email, access_token, refresh_token, token_expiry, updated_at
    FROM public.sheets_connections WHERE user_id = all_users.user_id
  ) combined
  ORDER BY updated_at DESC
  LIMIT 1
) best
ON CONFLICT (user_id) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260519120000_create_google_connections.sql
git commit -m "feat: add google_connections migration with backfill from 3 old tables"
```

---

### Task 2: Create shared token refresh utility

**Files:**
- Create: `supabase/functions/_shared/googleToken.ts`

- [ ] **Step 1: Write the shared utility**

```typescript
import { type SupabaseClient } from './supabase.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string; email: string } | null> {
  try {
    const { data: connection, error } = await supabase
      .from('google_connections')
      .select('id, access_token, email, refresh_token, token_expiry')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !connection) return null;

    const expiry = new Date(connection.token_expiry);
    const now = new Date();

    if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
      return { accessToken: connection.access_token, email: connection.email };
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Google token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from('google_connections')
      .update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return { accessToken: data.access_token, email: connection.email };
  } catch (err) {
    console.error('getValidGoogleAccessToken error:', err);
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/googleToken.ts
git commit -m "feat: add shared Google token refresh utility"
```

---

### Task 3: Create unified `google-auth` edge function

**Files:**
- Create: `supabase/functions/google-auth/index.ts`

- [ ] **Step 1: Write the unified auth function**

```typescript
import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'profile',
].join(' ');

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'google-auth', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    const userId = authResult.auth.authUserId;
    const { action, code, redirectUri } = await req.json();

    if (action === 'getAuthUrl') {
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', userId);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: jsonHeaders },
      );
    }

    if (action === 'exchangeCode') {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        return new Response(
          JSON.stringify({ error: tokens.error_description || 'Failed to exchange code' }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const { error: upsertError } = await supabaseAdmin
        .from('google_connections')
        .upsert({
          user_id: userId,
          email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          scopes: SCOPES,
          calendar_id: 'primary',
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Failed to save tokens:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save Google connection' }),
          { status: 500, headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({ success: true, email: userInfo.email }),
        { headers: jsonHeaders },
      );
    }

    if (action === 'getStatus') {
      const { data } = await supabaseAdmin
        .from('google_connections')
        .select('email, calendar_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) {
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({ connected: true, email: data.email, calendarId: data.calendar_id }),
        { headers: jsonHeaders },
      );
    }

    if (action === 'disconnect') {
      const { error } = await supabaseAdmin
        .from('google_connections')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to disconnect:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect' }),
          { status: 500, headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: jsonHeaders },
    );
  } catch (error) {
    console.error('Error in google-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/google-auth/index.ts
git commit -m "feat: add unified google-auth edge function"
```

---

### Task 4: Update edge functions to use shared token utility and new table

**Files:**
- Modify: `supabase/functions/google-calendar-sync/index.ts`
- Modify: `supabase/functions/google-sheets-sync/index.ts`
- Modify: `supabase/functions/google-sheets-api/index.ts`
- Modify: `supabase/functions/_shared/gmail/api.ts`
- Modify: `supabase/functions/sheets-watch-start/index.ts`
- Modify: `supabase/functions/sheets-watch-stop/index.ts`
- Modify: `supabase/functions/sheets-watch-webhook/index.ts`

- [ ] **Step 1: Update `google-calendar-sync/index.ts`**

Remove the inline `getValidAccessToken` function (lines 10-60) and the `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` constants (lines 10-11). Add import for shared utility. Change all `calendar_connections` references to `google_connections`.

At the top, replace:
```typescript
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

async function getValidAccessToken(
  connection: { access_token: string; refresh_token: string; token_expiry: string; user_id: string; id: string },
  supabase: any
): Promise<string | null> {
  // ... entire function body (lines 13-60)
}
```

With:
```typescript
import { getValidGoogleAccessToken } from '../_shared/googleToken.ts';
```

Then update all call sites:
- `const accessToken = await getValidAccessToken(connection, supabase)` becomes `const result = await getValidGoogleAccessToken(supabase, connection.user_id); const accessToken = result?.accessToken ?? null;`
- All `.from('calendar_connections')` becomes `.from('google_connections')`
- Remove `user_name` references (the `user_name: connection.user_name || null` in appointment inserts — replace with `null`)

- [ ] **Step 2: Update `google-sheets-sync/index.ts`**

Same pattern: remove inline `getValidAccessToken` (lines 40-85) and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (lines 11-12). Add import. Change `sheets_connections` to `google_connections`. Remove `user_name`/`team_member_name` filter logic — use `user_id` only.

- [ ] **Step 3: Update `google-sheets-api/index.ts`**

Remove inline `getValidAccessToken` (lines 10-58) and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (lines 10-11). Add import. Change `sheets_connections` to `google_connections`. Remove `teamMemberName`/`user_name` filter logic (lines 107-108) — use `user_id` only.

- [ ] **Step 4: Update `_shared/gmail/api.ts`**

Change the import from `../gmailToken.ts` to `../googleToken.ts` and update `getValidAccessToken`:

Replace:
```typescript
import { getGmailAccessTokenForUser } from '../gmailToken.ts';

export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const token = await getGmailAccessTokenForUser(supabase, userId);
  if (!token) throw new Error('Gmail not connected');
  return token.accessToken;
}
```

With:
```typescript
import { getValidGoogleAccessToken } from '../googleToken.ts';

export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const result = await getValidGoogleAccessToken(supabase, userId);
  if (!result) throw new Error('Gmail not connected');
  return result.accessToken;
}
```

- [ ] **Step 5: Update `sheets-watch-start/index.ts`**

Replace import:
```typescript
// Old:
import { getValidSheetsAccessToken } from '../_shared/googleTokenRefresh.ts';
// New:
import { getValidGoogleAccessToken } from '../_shared/googleToken.ts';
```

Change `sheets_connections` to `google_connections` (lines 49, 99-108). Remove `user_name` filter (line 50). Update token call:
```typescript
// Old:
const accessToken = await getValidSheetsAccessToken(connection, admin);
// New:
const tokenResult = await getValidGoogleAccessToken(admin, userId);
const accessToken = tokenResult?.accessToken ?? null;
```

- [ ] **Step 6: Update `sheets-watch-stop/index.ts`**

Same pattern as watch-start: replace import, change `sheets_connections` to `google_connections` (lines 46-47, 73-83), remove `user_name` filter (line 47), update token call (line 54).

- [ ] **Step 7: Update `sheets-watch-webhook/index.ts`**

Change `sheets_connections` to `google_connections` (lines 43-45).

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/google-calendar-sync/index.ts \
       supabase/functions/google-sheets-sync/index.ts \
       supabase/functions/google-sheets-api/index.ts \
       supabase/functions/_shared/gmail/api.ts \
       supabase/functions/sheets-watch-start/index.ts \
       supabase/functions/sheets-watch-stop/index.ts \
       supabase/functions/sheets-watch-webhook/index.ts
git commit -m "refactor: update edge functions to use google_connections and shared token utility"
```

---

### Task 5: Create unified `GoogleCallback` page

**Files:**
- Create: `src/pages/admin/GoogleCallback.tsx`

- [ ] **Step 1: Write the unified callback page**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      const notifyParent = (data: { type: string; email?: string; error?: string }) => {
        if (window.opener) {
          try {
            window.opener.postMessage(data, '*');
          } catch {
            // Ignore cross-origin errors
          }
        }
        localStorage.setItem('google-auth-result', JSON.stringify({
          ...data,
          timestamp: Date.now(),
        }));
      };

      const closeOrRedirect = () => {
        const isLikelyPopup = window.opener || window.innerWidth < 600;
        if (isLikelyPopup) {
          try { window.close(); } catch { /* ignore */ }
          setTimeout(() => {
            if (!window.closed) navigate('/admin');
          }, 500);
        } else {
          const returnPath = localStorage.getItem('google_return_path');
          localStorage.removeItem('google_return_path');
          navigate(returnPath || '/admin');
        }
      };

      if (error) {
        setStatus('error');
        setMessage('Authorization was denied or failed');
        notifyParent({ type: 'GOOGLE_AUTH_ERROR', error });
        setTimeout(closeOrRedirect, 1500);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received');
        notifyParent({ type: 'GOOGLE_AUTH_ERROR', error: 'No code' });
        setTimeout(closeOrRedirect, 1500);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        const { data, error: exchangeError } = await supabase.functions.invoke('google-auth', {
          body: { action: 'exchangeCode', code, redirectUri },
        });

        if (exchangeError) throw exchangeError;

        if (data.success) {
          setStatus('success');
          setMessage(`Connected: ${data.email}`);
          notifyParent({ type: 'GOOGLE_CONNECTED', email: data.email });
          setTimeout(closeOrRedirect, 1000);
        } else {
          throw new Error(data.error || 'Failed to connect');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage('Failed to connect Google account');
        notifyParent({ type: 'GOOGLE_AUTH_ERROR', error: String(err) });
        setTimeout(closeOrRedirect, 1500);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Connecting Google Account...</h1>
            <p className="text-muted-foreground">Please wait while we complete the connection.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <span className="text-2xl text-green-600 dark:text-green-400">✓</span>
            </div>
            <h1 className="text-xl font-semibold text-green-600 dark:text-green-400">Connected!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">You can close this window now.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mx-auto">
              <span className="text-2xl text-red-600 dark:text-red-400">✗</span>
            </div>
            <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">Connection Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting back...</p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/GoogleCallback.tsx
git commit -m "feat: add unified GoogleCallback page"
```

---

### Task 6: Update React hooks

**Files:**
- Modify: `src/hooks/useCalendarData.ts`
- Modify: `src/hooks/useGoogleSheets.ts`
- Modify: `src/hooks/useGmailConnection.ts`
- Modify: `src/components/gmail/gmailHelpers.ts`

- [ ] **Step 1: Update `useCalendarData.ts`**

Change the callback URL helper (line 46-49):
```typescript
// Old:
const getCalendarCallbackUrl = () => {
  const prefix = window.location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  return `${window.location.origin}${prefix}/calendar-callback`;
};
// New:
const getGoogleCallbackUrl = () => {
  const prefix = window.location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  return `${window.location.origin}${prefix}/google-callback`;
};
```

Update `checkCalendarStatus` (line 94): change `'google-calendar-auth'` to `'google-auth'`.

Update message/storage event handling (lines 108-153): change `'GOOGLE_CALENDAR_CONNECTED'` to `'GOOGLE_CONNECTED'`, `'GOOGLE_CALENDAR_ERROR'` to `'GOOGLE_AUTH_ERROR'`, localStorage key from `'google-calendar-auth-result'` to `'google-auth-result'`.

Update `connectCalendar` (line 368-380): change `calendarCallbackUrl` localStorage key to `googleCallbackUrl`, change `'google-calendar-auth'` invoke to `'google-auth'`, use `getGoogleCallbackUrl()`.

Update `disconnectCalendar` (line 402): change `'google-calendar-auth'` to `'google-auth'`.

Remove `localStorage.removeItem('calendarCallbackUrl')` and `localStorage.removeItem('calendarTeamMember')` references — no longer needed.

- [ ] **Step 2: Update `useGoogleSheets.ts`**

In `checkConnection` (line 32): change `'google-sheets-auth'` to `'google-auth'`.

In `connect` (line 65): change redirect path from `'/superadmin/sheets-callback'` to `'/superadmin/google-callback'`. Change `'google-sheets-auth'` invoke to `'google-auth'`. Remove `teamMemberName` from the body. Change postMessage type from `'sheets-auth'` to `'GOOGLE_CONNECTED'`.

In `disconnect` (line 98): change `'google-sheets-auth'` to `'google-auth'`. Remove `teamMemberName` from the body.

- [ ] **Step 3: Update `useGmailConnection.ts`**

In connection status query (line 111-115): change `'gmail_connections'` to `'google_connections'`.

In `connectGmail` (line 197): change `gmail-auth?action=get-oauth-url` to use `supabase.functions.invoke('google-auth', { body: { action: 'getAuthUrl', redirectUri: callbackUrl } })`. Update response handling: `data.url` becomes `data.authUrl`.

In `disconnectGmail` (line 225-228): change `'gmail_connections'` to `'google_connections'`.

Update `getGmailCallbackUrl` call — the callback prefix changes.

- [ ] **Step 4: Update `gmailHelpers.ts`**

Change callback URL (line 93):
```typescript
// Old:
export const getGmailCallbackUrl = (pathPrefix: 'admin' | 'superadmin' = 'admin') => {
  return `${window.location.origin}/${pathPrefix}/inbox/callback`;
};
// New:
export const getGmailCallbackUrl = (pathPrefix: 'admin' | 'superadmin' = 'admin') => {
  return `${window.location.origin}/${pathPrefix}/google-callback`;
};
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCalendarData.ts \
       src/hooks/useGoogleSheets.ts \
       src/hooks/useGmailConnection.ts \
       src/components/gmail/gmailHelpers.ts
git commit -m "refactor: update hooks to use unified google-auth and google_connections"
```

---

### Task 7: Update components with direct `gmail_connections` table reads

**Files:**
- Modify: `src/components/admin/LeadDetailDialog.tsx:609`
- Modify: `src/components/admin/PipelineExpandedView.tsx:587`
- Modify: `src/components/admin/UnderwritingExpandedView.tsx:816`
- Modify: `src/components/admin/LenderManagementExpandedView.tsx:522`
- Modify: `src/components/admin/LenderExpandedView.tsx:280`
- Modify: `src/components/admin/ProjectDetailPanel.tsx:133`
- Modify: `src/components/admin/settings/IntegrationsSection.tsx:88`

- [ ] **Step 1: In all 7 files, change the table name**

Find and replace in each file:
```typescript
// Old:
.from('gmail_connections')
// New:
.from('google_connections')
```

The column names (`user_id`, `email`, `id`) remain the same, so no other changes needed.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/LeadDetailDialog.tsx \
       src/components/admin/PipelineExpandedView.tsx \
       src/components/admin/UnderwritingExpandedView.tsx \
       src/components/admin/LenderManagementExpandedView.tsx \
       src/components/admin/LenderExpandedView.tsx \
       src/components/admin/ProjectDetailPanel.tsx \
       src/components/admin/settings/IntegrationsSection.tsx
git commit -m "refactor: update components to use google_connections table"
```

---

### Task 8: Update routes in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update lazy imports**

Replace:
```typescript
const AdminInboxCallback = lazy(() => import("./pages/admin/InboxCallback"));
// ...
const CalendarCallback = lazy(() => import("./pages/admin/CalendarCallback"));
const SheetsCallback = lazy(() => import("./pages/admin/SheetsCallback"));
```

With:
```typescript
const GoogleCallback = lazy(() => import("./pages/admin/GoogleCallback"));
```

- [ ] **Step 2: Update route definitions**

Replace the superadmin callback routes (lines 170-172):
```tsx
{/* Old: */}
<Route path="/superadmin/inbox/callback" element={<AdminInboxCallback />} />
<Route path="/superadmin/calendar-callback" element={<CalendarCallback />} />
<Route path="/superadmin/sheets-callback" element={<SheetsCallback />} />

{/* New: */}
<Route path="/superadmin/google-callback" element={<GoogleCallback />} />
```

Replace the admin callback routes (lines 213, 220-221):
```tsx
{/* Old: */}
<Route path="/admin/sheets-callback" element={<SheetsCallback />} />
{/* ... */}
<Route path="/admin/inbox/callback" element={<AdminInboxCallback />} />
<Route path="/admin/calendar-callback" element={<CalendarCallback />} />

{/* New: */}
<Route path="/admin/google-callback" element={<GoogleCallback />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: replace 3 callback routes with unified google-callback"
```

---

### Task 9: Delete old files

**Files:**
- Delete: `supabase/functions/google-calendar-auth/index.ts`
- Delete: `supabase/functions/google-sheets-auth/index.ts`
- Delete: `supabase/functions/gmail-auth/index.ts`
- Delete: `supabase/functions/_shared/googleTokenRefresh.ts`
- Delete: `supabase/functions/_shared/gmailToken.ts`
- Delete: `src/pages/admin/CalendarCallback.tsx`
- Delete: `src/pages/admin/SheetsCallback.tsx`
- Delete: `src/pages/admin/InboxCallback.tsx`

- [ ] **Step 1: Delete all old files**

```bash
rm -rf supabase/functions/google-calendar-auth
rm -rf supabase/functions/google-sheets-auth
rm -rf supabase/functions/gmail-auth
rm supabase/functions/_shared/googleTokenRefresh.ts
rm supabase/functions/_shared/gmailToken.ts
rm src/pages/admin/CalendarCallback.tsx
rm src/pages/admin/SheetsCallback.tsx
rm src/pages/admin/InboxCallback.tsx
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: delete old Google OAuth files replaced by unified google-auth"
```

---

### Task 10: Verify build

- [ ] **Step 1: Run TypeScript / lint check**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 3: Fix any build/lint errors**

If there are import errors or missing references, fix them. Common issues:
- Leftover imports of deleted files
- TypeScript type mismatches from the old table types in `types.ts` (auto-generated — these won't update until `generate-schema` runs, but shouldn't block build since Supabase client uses runtime types)

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve build errors from Google OAuth unification"
```

---

### Task 11: Create migration to drop old tables (separate, apply later)

**Files:**
- Create: `supabase/migrations/20260519120001_drop_old_google_tables.sql`

- [ ] **Step 1: Write the drop migration**

```sql
-- Drop old Google OAuth connection tables.
-- Only run AFTER verifying the unified google_connections table works correctly.
DROP TABLE IF EXISTS public.calendar_connections;
DROP TABLE IF EXISTS public.gmail_connections;
DROP TABLE IF EXISTS public.sheets_connections;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260519120001_drop_old_google_tables.sql
git commit -m "chore: add migration to drop old Google connection tables (apply after verification)"
```
