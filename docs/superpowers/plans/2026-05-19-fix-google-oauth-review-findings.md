# Fix Google OAuth Review Findings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs found during code review of the unified Google OAuth migration: wrong user ID lookup in call automation, localStorage key mismatch for return path, and backfilled rows claiming scopes they don't have.

**Architecture:** Three independent fixes. Finding #2 (auth ID mismatch) resolves `users.user_id` (auth UUID) from the public `users.id` before calling the Google token helper. Finding #3 (localStorage key) aligns the write key with the read key. Finding #1 (migration scopes) adds a `needs_reauth` flag so backfilled rows force re-consent.

**Tech Stack:** Supabase Edge Functions (Deno TypeScript), React hooks, SQL migration

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/functions/call-to-lead-automation/index.ts` | Modify | Resolve auth UUID before calling `getValidGoogleAccessToken` |
| `src/hooks/useGmailConnection.ts` | Modify | Fix localStorage key from `gmail_return_path` to `google_return_path` |
| `supabase/migrations/20260519130000_add_needs_reauth_to_google_connections.sql` | Create | Add `needs_reauth` column, set `true` for backfilled rows |
| `supabase/functions/google-auth/index.ts` | Modify | Set `needs_reauth = false` on fresh `exchangeCode`, return flag in `getStatus` |

---

### Task 1: Fix auth ID mismatch in call-to-lead-automation (HIGH)

**Context:** `communications.user_id` is a FK to `users.id` (the public table PK). But `google_connections.user_id` stores `auth.uid()` (the Supabase auth UUID). These are different columns. The function passes `users.id` into `getValidGoogleAccessToken()`, which queries by `google_connections.user_id` — so it never finds a match, and Gmail drafts silently stop being created.

**Files:**
- Modify: `supabase/functions/call-to-lead-automation/index.ts:89-109` (user lookup block)
- Modify: `supabase/functions/call-to-lead-automation/index.ts:241` (token lookup call)

- [ ] **Step 1: Update the rep lookup to also fetch the auth UUID**

At line 100-108, the function already queries `users` to get `repName`. Extend that query to also select `user_id` (the auth UUID column). Then use the auth UUID for the Gmail token lookup.

Current code at `call-to-lead-automation/index.ts:99-109`:
```ts
let repName = 'Our team';
if (repTeamMemberId) {
  const { data: rep } = await supabase
    .from('users')
    .select('name')
    .eq('id', repTeamMemberId)
    .maybeSingle();
  if (rep?.name && (rep.name as string).trim().length > 0) {
    repName = rep.name as string;
  }
}
```

Replace with:
```ts
let repName = 'Our team';
let repAuthUserId: string | null = null;
if (repTeamMemberId) {
  const { data: rep } = await supabase
    .from('users')
    .select('name, user_id')
    .eq('id', repTeamMemberId)
    .maybeSingle();
  if (rep?.name && (rep.name as string).trim().length > 0) {
    repName = rep.name as string;
  }
  repAuthUserId = (rep?.user_id as string | undefined) ?? null;
}
```

- [ ] **Step 2: Use `repAuthUserId` for the Gmail token lookup**

At line 236-241, update the condition and the call:

Current code:
```ts
if (!repTeamMemberId) {
  console.log("No rep team member id resolved for this call — skipping Gmail draft");
} else {
  console.log(`Creating Gmail draft for ${repName}...`);

  const gmailCreds = await getValidGoogleAccessToken(supabase, repTeamMemberId);
```

Replace with:
```ts
if (!repAuthUserId) {
  console.log("No rep auth user id resolved for this call — skipping Gmail draft");
} else {
  console.log(`Creating Gmail draft for ${repName}...`);

  const gmailCreds = await getValidGoogleAccessToken(supabase, repAuthUserId);
```

- [ ] **Step 3: Verify the build**

Run: `cd supabase && deno check functions/call-to-lead-automation/index.ts`
(Or just confirm there are no syntax errors via the editor.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/call-to-lead-automation/index.ts
git commit -m "fix: resolve auth UUID before Google token lookup in call automation

communications.user_id is a FK to users.id (public PK), but
google_connections.user_id stores auth.uid(). Now resolves
users.user_id (auth UUID) before calling getValidGoogleAccessToken."
```

---

### Task 2: Fix localStorage key mismatch for Gmail return path (MEDIUM)

**Context:** `useGmailConnection.ts:204` writes `gmail_return_path`, but `GoogleCallback.tsx:39` reads `google_return_path`. After OAuth, Gmail users always land on `/admin` instead of back on `/admin/gmail`.

**Files:**
- Modify: `src/hooks/useGmailConnection.ts:204`

- [ ] **Step 1: Change the localStorage key to match GoogleCallback**

At `src/hooks/useGmailConnection.ts:204`:

Current code:
```ts
localStorage.setItem('gmail_return_path', returnPath);
```

Replace with:
```ts
localStorage.setItem('google_return_path', returnPath);
```

This matches `GoogleCallback.tsx:39` which reads `google_return_path`. The unified key name is correct because OAuth is now unified across all Google services.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: no errors related to this change.

- [ ] **Step 3: Manual test**

1. Go to `/admin/gmail` while not connected to Google.
2. Click "Connect Gmail."
3. Complete OAuth consent.
4. After callback, you should land back on `/admin/gmail` (not `/admin`).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGmailConnection.ts
git commit -m "fix: align Gmail return path localStorage key with GoogleCallback

useGmailConnection wrote 'gmail_return_path' but GoogleCallback
read 'google_return_path'. Users landed on /admin instead of
/admin/gmail after connecting."
```

---

### Task 3: Add `needs_reauth` flag for backfilled Google connections (HIGH)

**Context:** The migration backfills `google_connections` using a token from whichever legacy table had the latest `updated_at`. That token only has that one product's scopes — not the full combined scopes. But the migration writes the full scope string, making the row look valid. API calls for products the token wasn't granted for will fail with Google "insufficient scopes" errors.

This task adds a `needs_reauth` boolean column. Backfilled rows get `true`; fresh OAuth connections get `false`. The status endpoint and frontend can use this to prompt re-consent.

**Files:**
- Create: `supabase/migrations/20260519130000_add_needs_reauth_to_google_connections.sql`
- Modify: `supabase/functions/google-auth/index.ts:92-100` (exchangeCode upsert)
- Modify: `supabase/functions/google-auth/index.ts:116-133` (getStatus response)

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260519130000_add_needs_reauth_to_google_connections.sql`:

```sql
-- Add needs_reauth flag. Backfilled rows have tokens that may lack
-- the full combined scopes; they need a fresh unified OAuth consent.

ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS needs_reauth BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing rows as needing re-auth.
-- Only rows created via the new unified flow (exchangeCode action)
-- should have needs_reauth = false; those rows set it explicitly.
UPDATE public.google_connections SET needs_reauth = true;
```

- [ ] **Step 2: Set `needs_reauth = false` on fresh OAuth connections**

At `supabase/functions/google-auth/index.ts:90-100`, add `needs_reauth: false` to the upsert:

Current code:
```ts
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
```

Replace with:
```ts
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
    needs_reauth: false,
  }, { onConflict: 'user_id' });
```

- [ ] **Step 3: Return `needs_reauth` in the status response**

At `supabase/functions/google-auth/index.ts:117-133`, add `needs_reauth` to the select and response:

Current code:
```ts
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
```

Replace with:
```ts
if (action === 'getStatus') {
  const { data } = await supabaseAdmin
    .from('google_connections')
    .select('email, calendar_id, needs_reauth')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return new Response(
      JSON.stringify({ connected: false }),
      { headers: jsonHeaders },
    );
  }

  return new Response(
    JSON.stringify({
      connected: true,
      email: data.email,
      calendarId: data.calendar_id,
      needsReauth: data.needs_reauth,
    }),
    { headers: jsonHeaders },
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260519130000_add_needs_reauth_to_google_connections.sql
git add supabase/functions/google-auth/index.ts
git commit -m "fix: add needs_reauth flag for backfilled Google connections

Backfilled rows have tokens from a single legacy table that may lack
combined scopes. The new column marks them for re-consent. Fresh
OAuth connections set needs_reauth = false. Status endpoint returns
the flag so frontend can prompt reconnection."
```

---

## Verification Checklist

After all three tasks:

- [ ] `npm run build` passes
- [ ] Deploy edge functions: `supabase functions deploy call-to-lead-automation google-auth`
- [ ] Apply migration: `supabase db push` (or `supabase migration up`)
- [ ] Test: trigger a call automation for a team member — Gmail draft should be created
- [ ] Test: connect Gmail from `/admin/gmail` — should redirect back to `/admin/gmail` after OAuth
- [ ] Test: check status of a backfilled user — `needsReauth` should be `true`
- [ ] Test: reconnect a backfilled user — `needsReauth` should become `false`
