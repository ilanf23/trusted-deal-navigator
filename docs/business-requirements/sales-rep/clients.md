# Clients

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/clients`
**Source file:** `src/pages/admin/Clients.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

A read-only list of authenticated client-portal users — people who have actually signed up at `/auth` with the `client` role and now have access to their own portal (contracts, invoices, messages). Distinct from *People* / *Companies* (which are CRM contacts, not necessarily portal users).

## Primary user

Sales rep verifying which counterparties have portal access. Secondary: founders auditing portal adoption.

## Entry points

- Sidebar nav: **Clients & Billing → Clients**

## What the user can do here

- Browse all client-portal users in a simple table
- Search by email or company name
- See join date

(No editing. No invite UI on this page — invites happen elsewhere.)

## Key business rules

- A "client" here = a row in `users` (or related table) with portal access permissions
- This page is informational — no actions; deactivation / role changes happen via `UsersAndRoles` (Ilan-only)
- Search is client-side over the loaded set

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Email | `clients.email` (or `users.email` for portal users) | |
| Company | `company_name` | |
| Contact person | `contact_person` | |
| Phone | `phone` | Hidden on mobile |
| Joined | `created_at` | Date only |

## User flows

### 1. Confirm a client has portal access
1. Rep searches the client's email
2. If row present → portal access exists
3. If absent → escalate to admin (Ilan) to provision via UsersAndRoles

## Edge cases & known gaps

- No invite UX (must go through UsersAndRoles)
- No way to see which contracts/invoices belong to which client from here — must navigate to those pages
- No filtering by status (active / suspended / deactivated)
- Read-only; corrections require SQL or admin tooling

---

## Technical anchors

### Components used
- `src/components/shared/DataTable.tsx`
- `AdminLayout` (not `EmployeeLayout`)

### Hooks / contexts
- Direct Supabase query in `useEffect`
- `useAdminTopBar`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `clients` (or `users` filtered by role) | ✓ | — |

### Edge functions
- None

### Permissions
- Route gate: `AdminRoute`
- Any admin can view

## Open questions

- [ ] Inline invite flow from this page?
- [ ] Status column (active / suspended / last login)?
- [ ] Drill-through to client's contracts / invoices / messages?
- [ ] Reconcile with `UsersAndRoles` so admins have one place to manage users?
