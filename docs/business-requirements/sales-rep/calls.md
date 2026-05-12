# Calls

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/calls`
**Source file:** `src/pages/admin/Calls.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

Single place for a sales rep to see, place, and attribute phone calls. Acts as the operational hub during the rep's workday — inbound calls land here, outbound calls start here, and call history is the system of record for what conversation happened on what deal.

## Primary user

Sales rep actively working a desk shift. Secondary readers: founders reviewing call activity, ops correcting attribution.

## Entry points

- Sidebar nav: **Communication → Calls**
- Incoming call popup → *View call* button
- Lead detail panel → *Calls* tab → *Open in Calls page*

## What the user can do here

- Place an outbound call to a known lead or arbitrary phone number
- See active calls in real time (their own + team, depending on role)
- Browse recent call history with filters (direction, status, date)
- Play back call recordings and read transcripts
- Attribute an unmatched call to an existing lead or create a new opportunity from it
- See whether an inbound call was answered, missed, or sent to voicemail

## Key business rules

- The Twilio client identity is shared (`clx-admin`); calls aren't routed to a single rep by SDK identity — attribution happens at the data layer via `lead_id` / `user_id`
- Inbound calls without a matching lead are still logged and shown as *Unattributed* until a rep links them
- Calls older than the selected filter window are hidden but never deleted
- Recordings are stored by Twilio; the page proxies playback rather than serving the file directly
- A missed inbound call should leave a `call_event` row even if the SDK never registered the incoming event (handled by the `twilio-call-history` backfill)

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Caller / callee name | `leads.name` joined via `lead_id` | Falls back to formatted phone number |
| Company | `leads.company_name` | |
| Direction | `evan_communications.direction` | inbound / outbound |
| Status | `evan_communications.status` | answered, missed, voicemail, in-progress |
| Duration | `evan_communications.duration_seconds` | rendered `mm:ss` |
| Timestamp | `evan_communications.created_at` | local TZ |
| Recording | `evan_communications.recording_url` | streamed via Twilio |
| Transcript | `evan_communications.transcript` | populated async after call ends |

## User flows

### 1. Place an outbound call to a lead
1. Rep clicks **Outbound Call** card
2. Searches/selects a lead (or pastes a phone number)
3. Clicks *Call* → `CallContext.makeOutboundCall()` fires
4. Twilio Device connects via `twilio-voice` edge function
5. Call appears in *Active Calls* until hangup
6. On hangup, row is upserted into *Recent Calls* with duration and recording (when available)

### 2. Receive and answer an inbound call
1. Twilio webhook hits `twilio-inbound` → TwiML dials browser + fallback phone
2. `CallContext` raises `incoming` event → `IncomingCallPopup` shows
3. Rep answers — call moves to *Active Calls* on the page
4. After hangup, recording + transcript backfill the row

### 3. Attribute an unmatched inbound call
1. Rep sees an *Unattributed* row in *Recent Calls*
2. Clicks the row → opens **Add Opportunity / Link Lead** dialog
3. Either selects an existing lead OR creates a new opportunity with caller info pre-filled
4. Row is updated with `lead_id`; future calls from that number auto-match

## Edge cases & known gaps

- If the Twilio token expires mid-shift (1h TTL), outbound dialing fails until next re-register (30s cycle) — surfaced as a toast but easy to miss
- Inbound calls during a page reload may not produce an SDK event; the backfill function catches these but with up to a few minutes of lag
- Recordings sometimes take 30–60s to become playable after hangup; UI shows a *Processing…* placeholder
- Transcripts can be empty for calls under ~10s
- No bulk attribution UI — high-volume cleanup requires SQL

---

## Technical anchors

### Components used
- `src/components/employee/OutboundCallCard.tsx`
- `src/components/employee/IncomingCallPopup.tsx` (mounted globally at App level)
- `src/components/admin/AddOpportunityDialog.tsx`

### Hooks / contexts
- `useCall()` — Twilio Device + active call state ([`CallContext`](../../../src/contexts/CallContext.tsx)) — **mounted at App root; do not move under a route**
- `useAuth()` — current user
- `useTeamMember()` — current rep's team info
- `useAssignableUsers()` — list of reps for attribution

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `active_calls` | ✓ | (via Twilio webhooks → edge fn) |
| `evan_communications` | ✓ | ✓ |
| `call_events` | ✓ | (via Twilio webhooks → edge fn) |
| `leads` | ✓ | — |

### Edge functions
- `twilio-token` — issues a 1h SDK token (identity `clx-admin`); Device re-registers every 30s
- `twilio-voice` — TwiML for outbound dial
- `twilio-inbound` — TwiML for inbound: dials browser client + fallback phone
- `twilio-connect-call` — REST fallback to redirect an in-flight call to the browser
- `twilio-call-history` — backfills missed/legacy calls from Twilio's API
- Signature verification on all webhook entrypoints

### Permissions
- Route gate: `AdminRoute` (any admin user)
- Row-level: reps see their own + team calls; founders see all

## Open questions

- [ ] Should missed inbound calls auto-create a lead with status `untouched`?
- [ ] How long do we keep recordings — indefinitely, or roll off at 90/180 days?
- [ ] Per-rep Twilio identity vs shared `clx-admin` — worth the routing complexity?
- [ ] Bulk attribution UI for cleanup days
