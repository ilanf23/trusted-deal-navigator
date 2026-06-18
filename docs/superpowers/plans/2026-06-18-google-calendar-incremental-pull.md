# Google Calendar Incremental Pull Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull Google Calendar changes into `appointments` automatically when the Calendar page opens and when the user clicks "Pull from Google".

**Architecture:** Keep the existing Calendar UI and `google-calendar-sync` edge function. Add one `calendar_sync_token` column, reuse Google Calendar incremental sync, and trigger the existing pull mutation silently on page open. No cron, no webhook, no new dependency.

**Tech Stack:** Supabase Postgres migrations, Supabase Deno edge functions, React 18, TanStack Query

**Spec:** `docs/superpowers/specs/2026-06-18-google-calendar-incremental-pull-design.md`

**Google API constraints:** Calendar incremental sync returns `nextSyncToken` only on the last page, includes deleted events in incremental responses, rejects expired tokens with `410 Gone`, and does not allow `timeMin` or `timeMax` with `syncToken`.

---

## File Structure

### Create

- `supabase/migrations/20260618120000_add_calendar_sync_token.sql` — one nullable token column on the existing per-user Google connection.
- `supabase/functions/google-calendar-sync/syncCore.mjs` — tiny pure helpers for Calendar API URL construction and Google event normalization.
- `supabase/functions/google-calendar-sync/syncCore.test.mjs` — Node built-in self-checks for the helper; no new test dependency.

### Modify

- `supabase/functions/google-calendar-sync/index.ts` — use incremental sync for `importFromGoogle`; reuse the same helper for `scheduledSync` only where it removes duplication. Do not add any scheduler.
- `src/hooks/useCalendarData.ts` — silently pull once after Calendar status is connected; keep manual pull button unchanged.

### Leave Alone

- Calendar UI components in `src/components/employee/calendar/*`.
- Google webhooks / `events.watch`.
- Background cron.
- Google OAuth scopes, unless the existing Calendar scope fails in verification.

---

### Task 1: Add Sync Token Column

**Files:**
- Create: `supabase/migrations/20260618120000_add_calendar_sync_token.sql`

- [ ] **Step 1: Write the migration**

```sql
alter table public.google_connections
  add column if not exists calendar_sync_token text;
```

- [ ] **Step 2: Verify migration syntax by inspection**

Run:

```bash
sed -n '1,40p' supabase/migrations/20260618120000_add_calendar_sync_token.sql
```

Expected output:

```text
alter table public.google_connections
  add column if not exists calendar_sync_token text;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260618120000_add_calendar_sync_token.sql
git commit -m "db: add google calendar sync token"
```

---

### Task 2: Add Minimal Sync Helper And Self-Check

**Files:**
- Create: `supabase/functions/google-calendar-sync/syncCore.mjs`
- Create: `supabase/functions/google-calendar-sync/syncCore.test.mjs`

- [ ] **Step 1: Write the failing self-check**

Create `supabase/functions/google-calendar-sync/syncCore.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEventsListUrl,
  googleEventToAppointmentFields,
  isCancelledGoogleEvent,
} from './syncCore.mjs';

test('initial pull uses a bounded time window and no sync token', () => {
  const url = new URL(buildEventsListUrl({
    calendarId: 'primary',
    nowIso: '2026-06-18T12:00:00.000Z',
  }));

  assert.equal(url.pathname, '/calendar/v3/calendars/primary/events');
  assert.equal(url.searchParams.get('singleEvents'), 'true');
  assert.equal(url.searchParams.get('showDeleted'), 'true');
  assert.equal(url.searchParams.get('timeMin'), '2026-06-18T12:00:00.000Z');
  assert.equal(url.searchParams.get('timeMax'), '2026-09-16T12:00:00.000Z');
  assert.equal(url.searchParams.has('syncToken'), false);
});

test('incremental pull uses syncToken and omits timeMin/timeMax', () => {
  const url = new URL(buildEventsListUrl({
    calendarId: 'primary',
    syncToken: 'token-123',
    pageToken: 'page-456',
    nowIso: '2026-06-18T12:00:00.000Z',
  }));

  assert.equal(url.searchParams.get('syncToken'), 'token-123');
  assert.equal(url.searchParams.get('pageToken'), 'page-456');
  assert.equal(url.searchParams.get('showDeleted'), 'true');
  assert.equal(url.searchParams.has('timeMin'), false);
  assert.equal(url.searchParams.has('timeMax'), false);
});

test('cancelled Google events are detected', () => {
  assert.equal(isCancelledGoogleEvent({ id: 'event-1', status: 'cancelled' }), true);
  assert.equal(isCancelledGoogleEvent({ id: 'event-2', status: 'confirmed' }), false);
});

test('timed Google events map to appointment fields', () => {
  const fields = googleEventToAppointmentFields({
    id: 'event-1',
    summary: 'Discovery Call',
    description: 'Borrower intro',
    start: { dateTime: '2026-06-19T14:00:00-04:00' },
    end: { dateTime: '2026-06-19T14:30:00-04:00' },
  }, {
    calendarId: 'primary',
    userId: 'user-row-1',
  });

  assert.deepEqual(fields, {
    title: 'Discovery Call',
    description: 'Borrower intro',
    start_time: '2026-06-19T14:00:00-04:00',
    end_time: '2026-06-19T14:30:00-04:00',
    google_event_id: 'event-1',
    google_calendar_id: 'primary',
    sync_status: 'synced',
    appointment_type: 'imported',
    user_name: null,
    user_id: 'user-row-1',
  });
});

test('all-day Google events are intentionally skipped for now', () => {
  const fields = googleEventToAppointmentFields({
    id: 'event-1',
    summary: 'All day hold',
    start: { date: '2026-06-19' },
    end: { date: '2026-06-20' },
  }, {
    calendarId: 'primary',
    userId: 'user-row-1',
  });

  assert.equal(fields, null);
});
```

- [ ] **Step 2: Run self-check and confirm it fails**

Run:

```bash
node --test supabase/functions/google-calendar-sync/syncCore.test.mjs
```

Expected: FAIL with `Cannot find module ... syncCore.mjs`.

- [ ] **Step 3: Add the helper**

Create `supabase/functions/google-calendar-sync/syncCore.mjs`:

```js
const GOOGLE_EVENTS_BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const INITIAL_SYNC_DAYS = 90;

export function buildEventsListUrl({
  calendarId,
  syncToken,
  pageToken,
  nowIso = new Date().toISOString(),
}) {
  const url = new URL(`${GOOGLE_EVENTS_BASE_URL}/${encodeURIComponent(calendarId || 'primary')}/events`);

  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('showDeleted', 'true');
  url.searchParams.set('maxResults', '2500');

  if (syncToken) {
    url.searchParams.set('syncToken', syncToken);
  } else {
    const now = new Date(nowIso);
    url.searchParams.set('timeMin', now.toISOString());
    url.searchParams.set(
      'timeMax',
      new Date(now.getTime() + INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    );
  }

  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  return url.toString();
}

export function isCancelledGoogleEvent(event) {
  return event?.status === 'cancelled';
}

export function googleEventToAppointmentFields(event, { calendarId, userId }) {
  if (!event?.start?.dateTime) {
    // ponytail: timed events only; add all-day mapping when appointments support all-day rows.
    return null;
  }

  return {
    title: event.summary || 'Untitled Event',
    description: event.description || null,
    start_time: event.start.dateTime,
    end_time: event.end?.dateTime || null,
    google_event_id: event.id,
    google_calendar_id: calendarId || 'primary',
    sync_status: 'synced',
    appointment_type: 'imported',
    user_name: null,
    user_id: userId,
  };
}
```

- [ ] **Step 4: Run self-check and confirm it passes**

Run:

```bash
node --test supabase/functions/google-calendar-sync/syncCore.test.mjs
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/google-calendar-sync/syncCore.mjs supabase/functions/google-calendar-sync/syncCore.test.mjs
git commit -m "test: cover google calendar sync helper"
```

---

### Task 3: Use Incremental Pull In `google-calendar-sync`

**Files:**
- Modify: `supabase/functions/google-calendar-sync/index.ts`

- [ ] **Step 1: Import helper**

Add after existing imports:

```ts
import {
  buildEventsListUrl,
  googleEventToAppointmentFields,
  isCancelledGoogleEvent,
} from './syncCore.mjs';
```

- [ ] **Step 2: Expand local types**

Replace the current `GoogleEvent` interface with:

```ts
interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface GoogleEventsPage {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface GoogleConnection {
  id: string;
  user_id: string;
  calendar_id: string | null;
  calendar_sync_token?: string | null;
}
```

- [ ] **Step 3: Replace `fetchFromGoogle` with a page fetcher**

Replace the existing `fetchFromGoogle` function with:

```ts
async function fetchGoogleEventsPage(
  accessToken: string,
  connection: GoogleConnection,
  pageToken?: string | null,
  forceFullSync = false,
  nowIso?: string,
): Promise<{ expiredSyncToken: boolean; page?: GoogleEventsPage }> {
  const url = buildEventsListUrl({
    calendarId: connection.calendar_id || 'primary',
    syncToken: forceFullSync ? null : connection.calendar_sync_token,
    pageToken,
    nowIso,
  });

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 410) {
    return { expiredSyncToken: true };
  }

  if (!response.ok) {
    throw new Error(`Google Calendar fetch failed: ${await response.text()}`);
  }

  return {
    expiredSyncToken: false,
    page: await response.json(),
  };
}
```

- [ ] **Step 4: Add per-event apply helper**

Add below `fetchGoogleEventsPage`:

```ts
async function applyGoogleEvent(
  supabase: ReturnType<typeof createClient>,
  event: GoogleEvent,
  connection: GoogleConnection,
  appUserId: string | null,
): Promise<'imported' | 'updated' | 'deleted' | 'skipped'> {
  if (isCancelledGoogleEvent(event)) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('google_event_id', event.id)
      .eq('user_id', appUserId);
    if (error) throw error;
    return 'deleted';
  }

  const fields = googleEventToAppointmentFields(event, {
    calendarId: connection.calendar_id || 'primary',
    userId: appUserId,
  });
  if (!fields) return 'skipped';

  const { data: existing, error: existingError } = await supabase
    .from('appointments')
    .select('id')
    .eq('google_event_id', event.id)
    .eq('user_id', appUserId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from('appointments')
      .update({
        title: fields.title,
        description: fields.description,
        start_time: fields.start_time,
        end_time: fields.end_time,
        google_calendar_id: fields.google_calendar_id,
        synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('id', existing.id);
    if (error) throw error;
    return 'updated';
  }

  const { error } = await supabase
    .from('appointments')
    .insert({
      ...fields,
      synced_at: new Date().toISOString(),
    });
  if (error) throw error;
  return 'imported';
}
```

- [ ] **Step 5: Add connection sync helper**

Add below `applyGoogleEvent`:

```ts
async function syncGoogleEventsForConnection(
  supabase: ReturnType<typeof createClient>,
  connection: GoogleConnection,
  appUserId: string | null,
  forceFullSync = false,
) {
  const tokenResult = await getValidGoogleAccessToken(supabase, connection.user_id, 'calendar');
  const accessToken = tokenResult?.accessToken ?? null;
  if (!accessToken) throw new Error('Failed to get access token');

  let imported = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;
  let pageToken: string | null = null;
  let latestSyncToken: string | null = null;
  const syncStartedAtIso = new Date().toISOString();

  for (;;) {
    const result = await fetchGoogleEventsPage(
      accessToken,
      connection,
      pageToken,
      forceFullSync,
      syncStartedAtIso,
    );
    if (result.expiredSyncToken) {
      await supabase
        .from('google_connections')
        .update({ calendar_sync_token: null, updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return syncGoogleEventsForConnection(
        supabase,
        { ...connection, calendar_sync_token: null },
        appUserId,
        true,
      );
    }

    const page = result.page;
    for (const event of page?.items || []) {
      try {
        const outcome = await applyGoogleEvent(supabase, event, connection, appUserId);
        if (outcome === 'imported') imported++;
        if (outcome === 'updated') updated++;
        if (outcome === 'deleted') deleted++;
        if (outcome === 'skipped') skipped++;
      } catch (err) {
        skipped++;
        console.error(`Failed to apply Google event ${event.id}:`, err);
      }
    }

    if (page?.nextSyncToken) latestSyncToken = page.nextSyncToken;
    if (!page?.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  if (latestSyncToken) {
    await supabase
      .from('google_connections')
      .update({
        calendar_sync_token: latestSyncToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
  }

  return { imported, updated, deleted, skipped };
}
```

- [ ] **Step 6: Update `importFromGoogle` branch**

Replace the body of the `if (action === 'importFromGoogle')` block with:

```ts
const result = await syncGoogleEventsForConnection(
  supabase,
  connection as GoogleConnection,
  teamMemberId,
);

return new Response(
  JSON.stringify({ success: true, ...result }),
  { headers: corsHeaders }
);
```

- [ ] **Step 7: Keep existing `syncAll` and Google push logic unchanged**

Do not modify `syncToGoogle`, `syncAppointment`, `syncAll`, or `deleteFromGoogle` in this task unless TypeScript requires a local type adjustment.

- [ ] **Step 8: Run helper self-check**

Run:

```bash
node --test supabase/functions/google-calendar-sync/syncCore.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/google-calendar-sync/index.ts
git commit -m "feat: pull google calendar incrementally"
```

---

### Task 4: Pull Once When Calendar Page Opens

**Files:**
- Modify: `src/hooks/useCalendarData.ts`

- [ ] **Step 1: Import `useRef`**

Change the first import to:

```ts
import { useState, useEffect, useCallback, useRef } from 'react';
```

- [ ] **Step 2: Add the once-per-mount guard**

Add after `const queryClient = useQueryClient();`:

```ts
const autoImportStartedRef = useRef(false);
```

- [ ] **Step 3: Make manual import accept a silent option**

Change the `importFromGoogle` mutation to:

```ts
const importFromGoogle = useMutation({
  mutationFn: async (_options?: { silent?: boolean }) => {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'importFromGoogle' },
    });
    if (error) throw error;
    return data;
  },
  onSuccess: (data, options) => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    if (!options?.silent) {
      toast.success(`Imported ${data.imported} new, updated ${data.updated} appointments`);
    }
  },
  onError: (error, options) => {
    if (options?.silent) {
      console.warn('Silent Google Calendar import failed:', error);
      return;
    }
    toast.error('Failed to import from Google Calendar');
  },
});
```

- [ ] **Step 4: Trigger silent import once after connection is known**

Add this effect immediately after the `importFromGoogle` mutation:

```ts
useEffect(() => {
  if (!calendarStatus?.connected || autoImportStartedRef.current || importFromGoogle.isPending) {
    return;
  }

  autoImportStartedRef.current = true;
  importFromGoogle.mutate({ silent: true });
}, [calendarStatus?.connected, importFromGoogle]);
```

- [ ] **Step 5: Leave CalendarView unchanged**

`CalendarView` already calls `importFromGoogle.mutate()` for the manual button, and the new mutation argument is optional.

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: build completes without TypeScript or Vite errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useCalendarData.ts
git commit -m "feat: auto-pull google calendar on open"
```

---

### Task 5: Final Verification And Deploy

**Files:**
- Check: `supabase/migrations/20260618120000_add_calendar_sync_token.sql`
- Check: `supabase/functions/google-calendar-sync/index.ts`
- Check: `supabase/functions/google-calendar-sync/syncCore.mjs`
- Check: `supabase/functions/google-calendar-sync/syncCore.test.mjs`
- Check: `src/hooks/useCalendarData.ts`

- [ ] **Step 1: Run helper self-check**

```bash
node --test supabase/functions/google-calendar-sync/syncCore.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS, or only pre-existing unrelated lint failures. If lint fails in touched files, fix before continuing.

- [ ] **Step 4: Deploy migration and edge function**

Project instructions require deploying after migration or edge-function changes.

```bash
npm run deploy
```

Expected: migration applies and `google-calendar-sync` deploys. If credentials/network block deploy, stop and report that deploy was not run.

- [ ] **Step 5: Manual smoke test**

1. Open `/admin/calendar`.
2. Confirm a connected Google Calendar account shows in the sidebar.
3. Create or edit a timed event directly in Google Calendar.
4. Reload `/admin/calendar`.
5. Confirm the Google event appears or updates in the app.
6. Delete that event directly in Google Calendar.
7. Click **Pull from Google**.
8. Confirm the matching app appointment disappears.

- [ ] **Step 6: Final commit if deployment changed tracked files**

```bash
git status --short
```

Expected: no uncommitted changes except unrelated pre-existing `.gitignore` and `.fuse_hidden` worktree changes.

---

## Skipped By Design

- No Google webhook or `events.watch`.
- No background scheduler.
- No new UI.
- No all-day event mapping until `appointments` has explicit all-day semantics.
- No unique index on existing `appointments.google_event_id`; add it later only after checking and cleaning historical duplicates.
