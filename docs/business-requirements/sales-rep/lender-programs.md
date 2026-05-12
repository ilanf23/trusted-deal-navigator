# Lender Programs

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/lender-programs` · detail: `/admin/lender-programs/expanded-view/:lenderId`
**Source file:** `src/pages/admin/LenderPrograms.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

A searchable directory of every lender the firm works with — their programs, loan ranges, accepted states, contact info, and call cadence. Reps use it to match a deal to a lender before reaching out, and to track outreach state per lender.

## Primary user

Sales rep matching a live deal to candidate lenders. Secondary: founders/ops maintaining the master lender list and uploading bulk updates.

## Entry points

- Sidebar nav: **Workflow → Lender Programs**
- Lead detail (Lender Management stage) → *Match lender* dialog
- Expanded view route from an existing pipeline row

## What the user can do here

- Browse all lenders in a sortable, filterable table
- Add a new lender row inline
- Edit lender fields directly in cells (loan size, states, types, call status)
- Bulk import via Excel/XLSX upload
- Reorder/resize columns; column order is persisted per user
- Save custom filters (e.g. *CRE lenders in TX*)
- Open the expanded view for full detail, including notes and call history

## Key business rules

- Lender table is shared across the firm — edits are global
- `call_status` tracks outreach state per lender (e.g. *active*, *cold*, *do not call*)
- `last_contact` and `next_call` are free-form dates used to time follow-ups
- States and loan types are comma-separated text (not enum) for flexibility
- Bulk import upserts by lender name + program name; collisions overwrite existing rows

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Lender name | `lender_programs.lender_name` | |
| Program | `program_name`, `program_type` | |
| Loan size | `loan_size_text` | Free-form, e.g. *$500K–$5M* |
| Loan types | `loan_types` | Comma-separated |
| States | `states` | Comma-separated |
| Call status | `call_status` | Outreach state |
| Last contact / next call | `last_contact`, `next_call` | |
| Contact | `contact_name`, `phone`, `email` | |

## User flows

### 1. Match a lender to a deal
1. Rep is on a lead in *Lender Management*
2. Opens Lender Programs in side panel or new tab
3. Filters by loan type + state
4. Adds matching lenders to the deal

### 2. Bulk import an updated lender list
1. Click *Upload*
2. Pick XLSX with the expected columns
3. Rows upserted; new lenders inserted, existing names updated
4. Success toast shows count

### 3. Drill into a single lender
1. Click row → expanded view at `/admin/lender-programs/expanded-view/:lenderId`
2. See full notes, contact history, attached programs

## Edge cases & known gaps

- Free-text states/loan types make filtering fuzzy — typos break matches
- No conflict resolution UI on bulk import (just last-write-wins)
- Column order persistence is per-user; no team default
- No version history on edits — can't see who changed what

---

## Technical anchors

### Components used
- `src/components/admin/LenderDetailPanel.tsx`
- `src/components/admin/PipelineBulkToolbar.tsx`
- `src/components/admin/ResizableColumnHeader.tsx`, `DraggableTh`, `DraggableColumnsContext`
- `src/components/admin/LenderFilterPanel.tsx`
- `src/components/admin/SavedFiltersSidebar.tsx`
- `AdminTopBarSearch`

### Hooks / contexts
- `useAutoFitColumns`, `useColumnOrder`
- TanStack Query for list + mutations
- `useAdminTopBar`, `usePageDatabases`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `lender_programs` | ✓ | ✓ |
| `lender_saved_filters` (or equivalent) | ✓ | ✓ |

### Edge functions
- None — direct Supabase + XLSX parsing client-side

### Permissions
- Route gate: `AdminRoute`
- RLS: any admin can read/write

## Open questions

- [ ] Promote loan types and states to controlled enums?
- [ ] Edit history / audit log per row?
- [ ] Bulk import dry-run preview before commit?
- [ ] Per-team-member assignment / ownership of lender relationships?
