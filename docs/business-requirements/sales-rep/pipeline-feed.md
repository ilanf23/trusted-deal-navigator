# Pipeline — Feed

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/pipeline/feed`
**Source file:** `src/pages/admin/PipelineFeed.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

A unified activity stream across all deals — calls, emails, notes, completed tasks, SMS, meetings — alongside system notifications (overdue tasks, AI call-quality flags). The rep's "what happened today across my book" view.

## Primary user

Sales rep starting their day or returning after a meeting and wanting to catch up on activity without opening individual deals.

## Entry points

- Sidebar nav: **Pipeline → Feed**
- Notification badge → *View all* deep links here

## What the user can do here

- Browse activity items in reverse chronological order
- Filter by activity type (Phone Call, Email, Note, SMS, To Do, Meeting, etc.)
- Filter by team member (own activity vs. team)
- Click any item → opens the underlying lead in a side dialog
- Mark unread notifications as read
- See overdue tasks count + jump straight to them

## Key business rules

- Activity items aggregate from many tables — there's no single "feed" table
- Filter chips collapse multiple raw types into UI buckets (e.g. *Zoom Call* + *Phone Call* both map to `call`)
- "Unread" applies only to AI call-rating notifications, not to general activity
- Activity feed is global (sees all reps' actions); filter to self for a personal view
- Refresh interval: 60s for notification queries; activity stream refetches on focus

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Activity items | `lead_activities`, `communications`, `tasks`, `outbound_emails`, `notes` | Unioned in hook |
| Author | `users` joined per row | Avatar in feed |
| Linked lead | each row's `lead_id` | Click opens detail |
| Unread notifications | `call_rating_notifications` where `read_at IS NULL` | Badge |
| Overdue tasks | `tasks` where `status='todo' AND due_date < now()` | Count |

## User flows

### 1. Morning catch-up
1. Open Feed → see overnight activity sorted newest first
2. Filter to *Phone Call* + *Email* → only customer-facing touches
3. Click a call → side panel opens the deal
4. Move on to overdue tasks via the count link

### 2. Triage an AI quality flag
1. Unread notification appears at top
2. Click → expand reasoning + transcript preview
3. Decide to listen → routes to `/admin/calls`
4. `read_at` set so it stops surfacing

## Edge cases & known gaps

- Refetch is interval-based; new activity can take up to a minute to appear
- Filter mapping is hardcoded in `FILTER_TYPE_MAP` — adding a new activity type requires a code change
- No grouping (e.g. "5 emails on Deal X today" stays as 5 separate rows)
- No search — only filter chips
- Heavy days produce long scroll lists; no pagination cursor surfaced in UI

---

## Technical anchors

### Components used
- `src/components/feed/FeedLeftPanel.tsx`, `FeedCenter.tsx`, `FeedRightPanel.tsx`
- `src/components/admin/LeadDetailDialog.tsx`
- `AdminTopBarSearch`

### Hooks
- `useFeedData` — unions activity sources
- `useTeamMember`, `useAssignableUsers`
- `useAdminTopBar`, `usePageDatabases`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `lead_activities` | ✓ | — |
| `communications` | ✓ | — |
| `tasks` | ✓ | (mark-read only) |
| `outbound_emails` | ✓ | — |
| `notes` | ✓ | — |
| `users` | ✓ | — |
| `call_rating_notifications` | ✓ | ✓ (mark read) |

### Edge functions
- None directly — direct Supabase queries

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see their own + team activity; founders see all

## Open questions

- [ ] Group multi-event-per-deal into a single row (digest style)?
- [ ] Server-side push (Supabase realtime) instead of 60s polling?
- [ ] Configurable filter mapping via DB instead of hardcoded constant?
- [ ] Pagination / infinite scroll for long days?
