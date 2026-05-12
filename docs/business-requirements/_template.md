# [Page Name]

**Status:** live | in-progress | planned | deprecated
**Portal:** Sales Rep | Super Admin | Partner | Public
**Route:** `/admin/example`
**Source file:** `src/pages/admin/Example.tsx`
**Last reviewed:** YYYY-MM-DD

---

## Purpose

One or two sentences. What does this page exist for, and what would break in the business if it disappeared?

## Primary user

Who is this page for, day-to-day? (e.g. *Sales rep working an active deal*, *Founder reviewing weekly pipeline*). If multiple roles use it differently, list each.

## Entry points

How does a user land here?
- Sidebar nav: *Section → Item*
- Linked from: *other page or system*
- Deep-linked from: *email, notification, etc.*

## What the user can do here

Bulleted list of capabilities in business terms — not UI labels. Examples:
- See every inbound call that came in today
- Click a call to open the lead it's tied to
- Add a missed call to an existing opportunity

## Key business rules

Rules the page enforces that aren't obvious from the UI:
- Calls older than 90 days are hidden by default
- A call can only be linked to a lead the rep owns
- Recording playback requires the user to be on the call's team

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Caller name | `leads.name` via `lead_id` | Falls back to phone number if unmatched |
| Call duration | `evan_communications.duration_seconds` | Displayed `mm:ss` |

## User flows

Numbered, end-to-end. Keep to the top 2–4 flows.

### 1. Logging a callback
1. Rep clicks **Outbound Call** card
2. Selects a lead from search
3. Confirms — Twilio dials the lead's phone
4. Call ends → row appears in *Recent Calls*

### 2. ...

## Edge cases & known gaps

- What happens when X data is missing?
- What's currently broken or papered-over?
- Stakeholder complaints worth tracking

---

## Technical anchors

### Components used
- `src/components/employee/OutboundCallCard.tsx`
- `src/components/admin/AddOpportunityDialog.tsx`

### Hooks
- `useCall()` — global Twilio device state ([`CallContext`](../../../src/contexts/CallContext.tsx))
- `useAssignableUsers()` — list of reps for assignment

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `active_calls` | ✓ | — |
| `evan_communications` | ✓ | ✓ (call logs) |
| `leads` | ✓ | — |

### Edge functions
- `twilio-token` — issues client SDK token
- `twilio-call-history` — backfills missed calls

### Permissions
- Role gate: `AdminRoute` (any admin user)
- Row-level: rep sees their own calls; founders see all

## Open questions

- [ ] Should missed inbound calls auto-create a lead?
- [ ] Do we keep recordings beyond 90 days?
