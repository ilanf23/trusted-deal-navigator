# Rate Watch

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/rate-watch`
**Source file:** `src/pages/admin/RateWatch.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

Tracks leads who want to refinance once rates drop to a target threshold. Reps maintain the list and reach out when market conditions hit a customer's target. Doubles as the back-end for the public Rate Watch questionnaire at `/ratewatch/:token`.

## Primary user

Sales rep working the refi pipeline — reviewing alerts, sending check-in emails, and converting watching leads into active deals when rates move.

## Entry points

- Sidebar nav: **Workflow → Rate Watch**
- New Rate Watch entries created from the public questionnaire submission
- AI Email Assistant → bulk outreach when rates move

## What the user can do here

- See every lead on Rate Watch with current vs target rate
- Sort/filter by loan type, target rate, gap to target
- Open a lead's full detail dialog
- Compose an email to a single lead (FloatingInbox) or bulk via AI Assistant
- Add a manual Rate Watch entry
- Export the list to Excel
- Copy a Rate Watch questionnaire link for outbound use

## Key business rules

- Each entry is one row keyed by `lead_id` + `loan_type`
- A lead can have multiple Rate Watch entries (e.g. one for CRE, one for WC)
- The questionnaire token is single-use and time-limited
- Auto-alerting on rate movements is *not* implemented — current rates are entered manually
- Bulk outreach uses email templates with merge fields for personalization

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Lead name + company | `leads` joined via `lead_id` | |
| Current rate | `rate_watch.current_rate` | Entered manually |
| Target rate | `rate_watch.target_rate` | |
| Gap | computed (current − target) | Highlighted when ≤ 0 |
| Loan type | `rate_watch.loan_type` | |
| Last touch | derived from `evan_communications` | |

## User flows

### 1. Triage when rates drop
1. Market rates fall — rep updates *current rate* on entries
2. Filter to *gap ≤ 0.25%*
3. Click *AI Email Assistant* → bulk-compose personalized outreach
4. Send → conversations land in Gmail; opens new deal as replies come in

### 2. Add an entry manually
1. Click **+ Add Rate Watch**
2. Search/select lead, enter current + target rate, loan type
3. Save → row added

### 3. Send questionnaire to a prospect
1. Copy the Rate Watch questionnaire link
2. Send it via email/SMS
3. Prospect fills it out at `/ratewatch/:token`
4. Submission auto-creates a Rate Watch entry + lead

## Edge cases & known gaps

- No automated rate-feed integration — current rates are manual
- No notification when a gap closes
- Bulk send via AI Assistant can hit Gmail rate limits on large lists
- Questionnaire tokens don't have a clean expiry/regenerate UI
- Export is client-side XLSX; large lists can freeze the browser

---

## Technical anchors

### Components used
- `src/components/admin/FloatingInbox.tsx`
- `src/components/admin/AIEmailAssistantSheet.tsx`
- `src/components/admin/LeadDetailDialog.tsx`
- `AdminLayout` (not `EmployeeLayout`)

### Hooks / contexts
- TanStack Query for list + mutations
- `useToast`, `useAdminTopBar`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `rate_watch` | ✓ | ✓ |
| `leads` / `potential` | ✓ | — |
| `evan_communications` | ✓ | — |

### Edge functions
- AI Email Assistant uses email generation edge fn (shared with Gmail composer)
- Public questionnaire submission writes via `submit-rate-watch` or similar (called from `/ratewatch/:token`)

### Permissions
- Route gate: `AdminRoute`
- Public questionnaire route is unauthenticated but token-gated

## Open questions

- [ ] Live rate-feed integration (treasury yields, SOFR, etc.) to auto-update current rates?
- [ ] Alerts when gap closes — email / in-app push?
- [ ] Token management UI (regenerate, expire, revoke)?
- [ ] Server-side export to handle large lists?
