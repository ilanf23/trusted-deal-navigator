# Contracts

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/contracts`
**Source file:** `src/pages/admin/Contracts.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

Manage the firm's representation agreements with clients — drafting, sending for review/signature, and tracking status through the contract lifecycle. The CRM-side mirror of what clients see in their portal.

## Primary user

Sales rep sending a new representation agreement to a closing client. Secondary: founders auditing executed contracts, ops chasing unsigned ones.

## Entry points

- Sidebar nav: **Clients & Billing → Contracts**
- Linked from a closing project (manual today)

## What the user can do here

- Browse all contracts with status badges
- Search by client or title
- Create a new contract: pick client, title, body
- View an existing contract's content
- See status: `draft`, `sent`, `viewed`, `signed`, `expired`, `cancelled`

## Key business rules

- Status is a Postgres enum: `draft` / `sent` / `viewed` / `signed` / `expired` / `cancelled`
- `viewed` is set automatically when the client opens the contract in their portal
- `signed` requires explicit acceptance in the client portal — no admin-side override
- `expired` is set by a backend job after a configurable window from `sent`
- Cancelling a contract is final; can't be uncancelled (must create new)
- Each contract belongs to exactly one client (`client_id` FK)

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Title | `contracts.title` | |
| Client | `contracts.client_id` → `clients.email` / `company_name` | |
| Status | `contracts.status` | Color-coded badge |
| Created | `contracts.created_at` | |
| Updated | `contracts.updated_at` | Last status change |

## User flows

### 1. Draft → send a contract
1. Click **+ New Contract**
2. Pick client, title, paste/write body
3. Save → `status = draft`
4. Send → `status = sent`; client gets notification in their portal

### 2. Track signature progress
1. Status auto-flips to `viewed` when client opens
2. After client signs → `status = signed` (final)
3. Activity log on the linked client/project gets an entry

### 3. Cancel a contract
1. Open contract → cancel
2. Status flips to `cancelled` — final, no undo

## Edge cases & known gaps

- Body is plain text/HTML — no rich editor with e-signature blocks
- No PDF generation on this page (client portal handles rendering)
- No template support — copy-paste from external templates
- No reminder cadence — `expired` is the only enforced state change
- No multi-party contracts (only one client per row)

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
| `contracts` | ✓ | ✓ |
| `clients` | ✓ | — |

### Edge functions
- Expiry-flip job (background, not page-direct)
- Client portal notifications for status changes

### Permissions
- Route gate: `AdminRoute`
- Any admin can create/cancel; only the client can `sign` via portal

## Open questions

- [ ] Rich editor with signature blocks?
- [ ] Templates (reuse common agreement language)?
- [ ] Configurable reminder cadence for unsigned contracts?
- [ ] PDF export from this page (not just portal)?
- [ ] Multi-party support for joint borrowers?
