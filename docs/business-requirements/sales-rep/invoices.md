# Invoices

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/invoices`
**Source file:** `src/pages/admin/Invoices.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

Manage commission and fee invoices issued to clients post-closing — drafting, sending, tracking payment status. Closes the loop on the revenue side of the deal lifecycle.

## Primary user

Sales rep or ops issuing the success-fee invoice once a deal funds. Secondary: founders tracking AR, accounting reconciling payments.

## Entry points

- Sidebar nav: **Clients & Billing → Invoices**
- (Future) auto-generated when a Project moves to `closed`

## What the user can do here

- Browse all invoices with status badges
- Search by client or description
- Create a new invoice: pick client, description, amount, due date
- View an existing invoice
- Track status: `draft`, `sent`, `viewed`, `paid`, `overdue`, `cancelled`

## Key business rules

- Status enum: `draft` / `sent` / `viewed` / `paid` / `overdue` / `cancelled`
- `viewed` is auto-set when the client opens the invoice in their portal
- `paid` is set manually after payment confirmation (no payment processor integration yet)
- `overdue` is set by a backend job when `due_date < now()` and status is still `sent` or `viewed`
- Cancelling is final
- Each invoice belongs to one client (`client_id` FK)
- Amount is stored as decimal in cents-equivalent precision

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Description | `invoices.description` | |
| Client | `invoices.client_id` → `clients.email` / `company_name` | |
| Amount | `invoices.amount` | Formatted currency |
| Due date | `invoices.due_date` | |
| Status | `invoices.status` | Color-coded badge |
| Created | `invoices.created_at` | |

## User flows

### 1. Issue a success-fee invoice
1. Project funds → ops opens Invoices
2. Click **+ New Invoice** → pick client, write description, enter amount + due date
3. Save → `status = draft`
4. Send → `status = sent`; client sees it in their portal

### 2. Mark paid after wire received
1. Confirm wire in bank
2. Open invoice → mark `paid` (manual)
3. Status flips → AR view excludes this row

### 3. Chase overdue
1. Filter invoices by `overdue`
2. Send reminder email (not yet automated)
3. Update status if paid; otherwise escalate

## Edge cases & known gaps

- No payment processor — `paid` is a manual flip (Stripe/ACH integration would close this)
- No auto-generation from closed projects yet — every invoice is hand-keyed
- No partial payments — invoice is binary paid/not-paid
- No commission split tracking (firm vs rep) — handled offline
- No PDF export from this page
- No automated reminder cadence for overdue

---

## Technical anchors

### Components used
- shadcn `Table`, `Dialog`, `Card`, `Badge`
- `DbTableBadge` (debug)
- `AdminLayout`

### Hooks / contexts
- Direct Supabase via `useEffect` + `useState`
- `useToast`
- `useAdminTopBar`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `invoices` | ✓ | ✓ |
| `clients` | ✓ | — |

### Edge functions
- Overdue-flip job (background, not page-direct)
- Client portal notifications for status changes

### Permissions
- Route gate: `AdminRoute`
- Any admin can create / mark paid / cancel

## Open questions

- [ ] Stripe/ACH integration to auto-mark `paid`?
- [ ] Auto-create invoice when a Project moves to `closed`?
- [ ] Partial-payment support?
- [ ] Commission split tracking (firm % vs rep %) on the row?
- [ ] PDF export / branded invoice template?
- [ ] Automated overdue reminder cadence?
