# Contacts — Companies

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/contacts/companies` · detail: `/admin/contacts/companies/expanded-view/:companyId`
**Source file:** `src/pages/admin/Companies.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

The firm's company directory — every borrower, lender entity, broker shop, and counterparty the firm has touched. Companies act as the umbrella that ties people and deals together (e.g. one borrower entity with three principals and two open deals).

## Primary user

Sales rep looking up an account, or qualifying inbound interest where the company name is the first signal. Secondary: founders reviewing account concentration; ops merging duplicates.

## Entry points

- Sidebar nav: **Contacts → Companies**
- "Add company" buttons from lead/person dialogs
- Linked from any deal's *Account* field
- Kanban view (by contact type) for visual triage

## What the user can do here

- View companies in Table or Kanban-by-type mode
- Inline-edit company name, phone, website, contact type, tags
- Multi-select → bulk reassign owner, tag, delete (with undo)
- Add a new company via dialog
- Open expanded view for full account card + linked people + linked deals
- Build/save/share filters
- See associated email domain for auto-matching inbound emails

## Key business rules

- Companies are uniquely identified by `company_name` + optional `email_domain`
- `contact_type` (free-text, e.g. *Borrower*, *Lender*, *Broker*, *Attorney*) groups companies in Kanban
- A company can have many people but each person belongs to at most one primary company
- Deleting a company triggers the global `useUndo` toast — restorable for a window
- Email-domain matching auto-suggests company when a new Gmail thread arrives from `@acme.com`

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Company name | `companies.company_name` | |
| Phone | `companies.phone` | |
| Primary contact | `companies.contact_name` | Free-text or linked person |
| Website | `companies.website` | |
| Contact type | `companies.contact_type` | Kanban column |
| Email domain | `companies.email_domain` | Used by Gmail auto-match |
| Tags | `companies.tags` (text[]) | |
| Last activity | derived from related deals + communications | |

## User flows

### 1. Add a new account
1. Rep clicks **+ Add Company**
2. Fill in name, type, optional domain/website
3. Save → row appears in Table and in the appropriate Kanban column

### 2. Triage inbound by company type
1. Switch to Kanban view
2. Visually scan *Borrower* column for new entries this week
3. Drag to *Lender* if mislabeled — `contact_type` updated

### 3. Bulk-delete with undo
1. Select 5 stale company rows
2. Bulk toolbar → *Delete*
3. Undo toast appears → click to restore if accidental

## Edge cases & known gaps

- Same company can exist twice with slight name variations (e.g. *Acme Inc.* vs *Acme, Inc*)
- `contact_type` is free-text; typos break Kanban grouping
- Email-domain auto-match doesn't catch multi-domain companies (e.g. acme.com + acmeholdings.com)
- No "merge companies" UI — ops handles via SQL
- Company-deal linking doesn't aggregate dollar-volume in the table view

---

## Technical anchors

### Components used
- `src/components/admin/CompanyDetailPanel.tsx`
- `src/components/admin/CompanyExpandedView.tsx` (route component)
- `src/components/admin/pipeline/kanban/*` (reused Kanban primitives)
- `SavedFiltersSidebar`, `CreateFilterDialog`
- `ResizableColumnHeader`, `DraggableTh`, `DraggableColumnsContext`
- `CrmAvatar`, `AdminTopBarSearch`

### Hooks / contexts
- `useCompanies` (variant of `useAllPipelineLeads`)
- `useTeamMember`, `useAssignableUsers`
- `useUndo` from `UndoContext`
- `useColumnOrder`, `useAutoFitColumns`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `companies` | ✓ | ✓ |
| `users` (linked people) | ✓ | — |
| `potential` / `underwriting` / `lender_management` (related deals) | ✓ | — |

### Edge functions
- None directly

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see own + team accounts; founders see all

## Open questions

- [ ] Merge-companies UI to handle name variants?
- [ ] Promote `contact_type` to enum?
- [ ] Multi-domain support for email auto-match?
- [ ] Aggregate deal-dollar-volume column in the company table?
