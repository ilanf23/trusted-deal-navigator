# Contacts — People

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/contacts/people` · detail: `/admin/contacts/people/expanded-view/:personId`
**Source file:** `src/pages/admin/People.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

The address book for every individual the firm interacts with — borrowers, lender reps, attorneys, accountants, referral partners. Decoupled from deals so the same person can be linked to multiple opportunities over time.

## Primary user

Sales rep looking up a contact's history or adding a newly-met person. Secondary: ops cleaning duplicates, founders auditing the network.

## Entry points

- Sidebar nav: **Contacts → People**
- "Add person" buttons throughout the app
- Linked from any deal's *People* tab
- Recently-viewed dropdown in the top bar

## What the user can do here

- Browse all people in a sortable, filterable table
- Inline-edit name, phone, email, role, tags
- Multi-select → bulk reassign owner, tag, delete
- Add a new person via dialog
- Open expanded view for full contact card + activity history
- Build/save/share filters
- Reorder/resize columns; persist per user
- Add to recently-viewed (auto, on detail open)

## Key business rules

- People live in the `users` table (which absorbed the former `people` / `team_members` / `profiles` tables)
- `app_role` distinguishes admin / partner / client / external-contact identities
- A person can be linked to multiple companies, deals, and lender programs simultaneously
- Recently-viewed list is per-user, stored in `localStorage`
- Deleting a person doesn't cascade — references in deals remain pointed at the row (soft preservation)

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Name | `users.name` | |
| Email | `users.email` | |
| Phone | `users.phone` | |
| Role / Title | `users.title` / `app_role` | |
| Linked company | join via `users.company_id` (or similar) | |
| Tags | `users.tags` (text[]) | Chips |
| Owner | `users.team_member_id` (the rep who owns the relationship) | Avatar |

## User flows

### 1. Add a newly-met person
1. Rep clicks **+ Add Person**
2. Fills in name, phone, email, optional company + role
3. Save → row appears, also surfaces in recently-viewed

### 2. Link person to a deal
1. From a deal detail panel → *People* tab → *Add existing*
2. Search → select → relationship saved
3. Person's activity tab now shows that deal's events

### 3. Bulk-tag for an outreach campaign
1. Multi-select 20 people
2. Bulk toolbar → *Add tag* → e.g. *Q2-2026 webinar*
3. Use that tag in an AI Email Assistant filter

## Edge cases & known gaps

- Dedupe is manual — same person can exist multiple times with different emails
- No merge UI; ops merges happen via SQL
- Tags are free-text; no controlled vocabulary
- Recently-viewed is `localStorage`, lost when browser data is cleared
- Phone numbers stored as-is — no normalization (E.164) so matching against Twilio call records is fuzzy

---

## Technical anchors

### Components used
- `src/components/admin/PeopleDetailPanel.tsx`
- `src/components/admin/PeopleExpandedView.tsx` (route component)
- `src/components/admin/PeopleFilterPanel.tsx`
- `SavedFiltersSidebar`, `PipelineBulkToolbar`, `PipelineSettingsPopover`
- `ResizableColumnHeader`, `DraggableTh`, `DraggableColumnsContext`
- `CrmAvatar`, `AdminTopBarSearch`

### Hooks
- TanStack Query directly against `users`
- `useTeamMember`, `useAssignableUsers`
- `useColumnOrder`, `useAutoFitColumns`
- `addRecentlyViewed` (lib helper)

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `users` | ✓ | ✓ |
| `people_saved_filters` (or similar) | ✓ | ✓ |

### Edge functions
- None directly

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see own + team relationships; founders see all

## Open questions

- [ ] Merge-duplicates UI?
- [ ] Phone normalization to E.164 for reliable call/SMS matching?
- [ ] Controlled tag vocabulary (or at least suggested tags)?
- [ ] Persistent recently-viewed (server-side instead of `localStorage`)?
