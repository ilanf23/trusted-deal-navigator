# Calendar

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/calendar`
**Source file:** `src/pages/admin/Calendar.tsx` (wraps `CalendarView`)
**Last reviewed:** 2026-05-11

---

## Purpose

The rep's appointment hub — a Google Calendar-style view of meetings, calls, and follow-ups, synced bidirectionally with the rep's actual Google Calendar so nothing falls between systems.

## Primary user

Sales rep planning their day/week — scheduling discovery calls, blocking prep time, and confirming meeting details before they happen.

## Entry points

- Sidebar nav: **Workflow → Calendar**
- Lead detail panel → *Schedule meeting* → opens with pre-filled invitee
- Google OAuth return → `/admin/calendar-callback`

## What the user can do here

- Connect a Google Calendar account
- View events in Month / Week / Day / Agenda views
- Create a new event with title, time, attendees, location, notes
- Drag to reschedule or resize duration
- Click an event to edit or delete
- See events synced from Google appear alongside CRM-created appointments

## Key business rules

- Events live in `appointments` (the CRM's source of truth); the sync edge function reconciles with Google
- Bidirectional sync: create in either system, the other catches up within the next sync window
- Deleting an event in the CRM also deletes it in Google (and vice versa)
- Each rep has their own connected calendar — no shared team calendar yet
- Time zone follows the rep's browser; underlying storage is UTC

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Event title | `appointments.title` | |
| Start / end | `appointments.start_at`, `end_at` | UTC; rendered local |
| Attendees | `appointments.attendees` (jsonb) | Includes lead linkage when applicable |
| Linked lead | `appointments.lead_id` | Clickable to lead detail |
| Source | `appointments.source` | `crm` / `google` |

## User flows

### 1. Connect Google Calendar
1. Click **Connect Google Calendar**
2. Redirect via `google-calendar-auth` edge fn → Google OAuth
3. Callback at `/admin/calendar-callback` → tokens stored in `calendar_connections`
4. Initial sync pulls upcoming events

### 2. Schedule a meeting from a lead
1. From lead detail, click *Schedule meeting*
2. Routes to Calendar with prefilled invitee + lead link
3. Pick time / save → `INSERT INTO appointments` → next sync pushes to Google

### 3. Drag to reschedule
1. Rep drags an event to a new slot
2. `UPDATE appointments` immediately
3. Sync push propagates to Google within seconds

## Edge cases & known gaps

- Sync lag can show a stale state for up to ~1 min after creating in Google directly
- Recurring events created in Google appear as individual instances; editing the series isn't supported from the CRM
- No attendee availability / free-busy lookup
- No shared team calendar view
- Cancellations made in Google sometimes leave orphan rows until next sync

---

## Technical anchors

### Components used
- `src/components/employee/calendar/CalendarView.tsx` — full calendar UI (FullCalendar 6 engine)
- `src/components/employee/EmployeeLayout.tsx`

### Hooks
- `useCalendarData` — events + connections
- `usePageDatabases`, `useAdminTopBar`

### Data sources

| Table / RPC | Read | Write |
|-------------|------|-------|
| `appointments` | ✓ | ✓ |
| `calendar_connections` | ✓ | (via auth fn) |
| `google-calendar-sync` (edge fn) | rpc | rpc |
| `google-calendar-auth` (edge fn) | rpc | rpc |

### Edge functions
- `google-calendar-auth` — OAuth flow + token refresh
- `google-calendar-sync` — pulls latest events from Google into `appointments`

### Permissions
- Route gate: `AdminRoute`
- Only the connecting rep can read/write their own calendar; founders see all via role check

## Open questions

- [ ] Shared team calendar view (founders see everyone's day)?
- [ ] Recurring event support beyond instance-by-instance?
- [ ] Attendee free/busy lookup when scheduling?
- [ ] Real-time push notifications when a synced event changes?
