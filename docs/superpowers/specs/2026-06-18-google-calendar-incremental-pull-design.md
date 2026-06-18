# Google Calendar Incremental Pull Sync

## Problem

The Calendar page already pushes app-created appointments to Google Calendar and supports a manual "Pull from Google" action. It does not automatically fetch Google-side changes when the user opens the page.

The current `google-calendar-sync` function imports a rolling 30-day range every time. That misses deletes, wastes API calls, and has no persisted `nextSyncToken`.

## Scope

Build Google-to-app pull sync that runs only when:

- the user opens the Calendar page and Google Calendar is connected
- the user clicks "Pull from Google"

No background cron, no Google `events.watch`, and no webhook receiver in this phase.

## Decisions

- `appointments` remains the app's calendar data store.
- `google_connections` gets one nullable `calendar_sync_token` column.
- The first pull performs a bounded full sync and stores Google's `nextSyncToken`.
- Later pulls use `syncToken` to fetch only changed events.
- Google `cancelled` events remove matching imported/synced appointments.
- A Google `410 Gone` response clears the token and retries one fresh full sync.
- Manual "Pull from Google" uses the same code path as the page-open pull.

## Data Model

Add:

```sql
alter table public.google_connections
  add column if not exists calendar_sync_token text;
```

No new table is needed because `google_connections` already has one row per auth user.

## Edge Function Design

Update `supabase/functions/google-calendar-sync/index.ts`.

Shared helper:

```ts
syncFromGoogleForConnection(connection, options)
```

Responsibilities:

- get a valid Calendar access token
- call `events.list`
- use `syncToken` when present
- otherwise use a bounded initial range
- page through results until complete
- upsert changed events into `appointments`
- delete rows for cancelled Google events
- store `nextSyncToken`

Initial full sync range:

- from now
- 90 days forward

This is enough for the current CRM calendar workflow without importing years of history.

## Frontend Design

Update `src/hooks/useCalendarData.ts`.

- keep the existing manual `importFromGoogle` mutation
- add one silent import effect after `calendarStatus.connected === true`
- guard with a ref so it runs once per hook mount
- skip if a sync is already pending
- after success, invalidate `appointments`
- only show toasts for manual pulls, not the automatic page-open pull

## Error Handling

- If Google token refresh fails, return a clear auth error and leave existing appointments untouched.
- If incremental sync returns `410`, clear `calendar_sync_token` and retry one full pull.
- If one event fails to upsert/delete, log it and continue syncing the rest.
- If page-open sync fails, log it without blocking the Calendar UI.
- Manual pull still shows the existing failure toast.

## Testing

Small checks only:

- Edge function can handle initial full sync response and stores a token.
- Edge function can handle incremental response with updated and cancelled events.
- `410` clears token and falls back to full sync.
- Calendar hook does not fire duplicate page-open imports during one mount.

## Implementation Steps

1. Add migration for `google_connections.calendar_sync_token`.
2. Refactor `google-calendar-sync` import logic into a reusable helper.
3. Change `importFromGoogle` and `scheduledSync` to use the helper where useful.
4. Add silent page-open import in `useCalendarData`.
5. Run type/build checks.

## Deferred

- Google push notifications via `events.watch`.
- Background cron sync.
- Watch renewal.
- Conflict resolution UI for edits made in both places.
- Recurring-series editing inside the CRM.
