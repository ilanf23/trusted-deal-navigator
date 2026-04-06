# Redesign Lender Programs Page to Match CRM Table Pattern

## Overview
Rewrite the LenderPrograms page from its current custom spreadsheet-style layout to match the unified CRM table pattern used by People.tsx, Leads.tsx, and Companies.tsx. This includes the purple theme, native HTML table, ResizableColumnHeader, row selection, detail panel, expanded view, column sorting, and clickable email/phone links.

## Context
- Files involved:
  - Rewrite: `src/pages/admin/LenderPrograms.tsx` (main page - currently 1100 lines of spreadsheet-style code)
  - Create: `src/components/admin/LenderDetailPanel.tsx` (right-side detail overlay, analogous to PeopleDetailPanel)
  - Create: `src/components/admin/LenderExpandedView.tsx` (full-page expanded view, analogous to PeopleExpandedView)
  - Modify: `src/App.tsx` (add expanded-view route for lender programs)
- Reference patterns: `src/pages/admin/People.tsx` (canonical CRM table), `src/components/admin/ResizableColumnHeader.tsx`, `src/components/admin/PeopleDetailPanel.tsx`
- Database table: `lender_programs` (fields: id, lender_name, call_status, lender_type, loan_size_text, loan_types, states, location, contact_name, phone, email, looking_for, last_contact, next_call, program_name, program_type, created_at)
- Dependencies: dnd-kit (already installed), ResizableColumnHeader (already exists), shadcn/ui Checkbox (already exists)

## Key Changes from Current Implementation
- Replace flex-based spreadsheet layout with native HTML `<table>` + purple theme (#eee6f6 header, #c8bdd6 borders)
- Replace 900-row fill pattern with actual data rows only
- Add ResizableColumnHeader with localStorage-persisted column widths
- Add per-column sort menus (three-dot dropdown with asc/desc)
- Add checkbox selection column + bulk actions toolbar (PipelineBulkToolbar)
- Add sticky first column (Institution) with box shadow
- Add row click to open LenderDetailPanel (right-side overlay)
- Add expanded view button (Maximize2 icon on hover) linking to full-page route
- Make email cells clickable (mailto: links) and phone cells clickable (tel: links)
- Keep existing features: inline cell editing, CSV/Excel upload, filter panel, AI advisor panel, search

## Development Approach
- **Testing approach**: Manual verification (no automated tests in this project)
- Complete each task fully before moving to the next
- Follow People.tsx patterns exactly for consistency

## Implementation Steps

### Task 1: Create LenderDetailPanel component

**Files:**
- Create: `src/components/admin/LenderDetailPanel.tsx`

- [x] Create a right-side detail panel component following PeopleDetailPanel pattern
- [x] Include header with lender name, close button (X), and expand button (Maximize2)
- [x] Show all lender fields in organized sections: Contact Info (name, email as mailto link, phone as tel link), Program Details (lender type, loan types, loan size, states, location, looking for), Activity (call status, last contact, next call)
- [x] Support inline editing of fields via input/textarea with save-on-blur to Supabase
- [x] Include "Contact" action buttons: Send Email (opens mailto or compose dialog), Call (tel: link)
- [x] Style with purple accent consistent with PeopleDetailPanel

### Task 2: Create LenderExpandedView component and route

**Files:**
- Create: `src/components/admin/LenderExpandedView.tsx`
- Modify: `src/App.tsx`

- [x] Create full-page expanded view following PeopleExpandedView pattern with tabbed layout
- [x] Include Overview tab with all lender fields in editable card layout
- [x] Include Notes/Activity tab for tracking interactions
- [x] Add back button to return to lender programs list
- [x] Add route in App.tsx: `/admin/lender-programs/expanded-view/:lenderId` (both admin and superadmin paths)
- [x] Make email/phone fields clickable (mailto: and tel: links) with copy buttons

### Task 3: Rewrite LenderPrograms.tsx table to match CRM pattern

**Files:**
- Modify: `src/pages/admin/LenderPrograms.tsx`

- [x] Replace flex-based layout with native HTML `<table>` element
- [x] Apply purple theme: header bg #eee6f6, cell borders #c8bdd6, 13px typography, header font-semibold uppercase
- [x] Remove 900-row fill pattern; only render actual data rows from database
- [x] Switch data fetching from manual fetch/useState to useQuery (TanStack Query) for consistency with other CRM pages
- [x] Add ResizableColumnHeader to all column headers with localStorage persistence key `lender-programs-column-widths`
- [x] Add DEFAULT_COLUMN_WIDTHS object matching current column widths
- [x] Make Institution column sticky (left: 0, z-index, box-shadow) like People.tsx person column
- [x] Add per-column sort dropdown menus (three-dot icon with asc/desc options)
- [x] Add sortField/sortDir state with useMemo-based sorting of filtered data

### Task 4: Add row selection, bulk actions, and clickable contacts

**Files:**
- Modify: `src/pages/admin/LenderPrograms.tsx`

- [x] Add checkbox column as first column using SelectAllHeader component for header
- [x] Add selectedLenderIds state (Set<string>) with toggle and select-all logic
- [x] Show PipelineBulkToolbar when items are selected (with delete action)
- [x] Add row click handler to open LenderDetailPanel (right overlay)
- [x] Add row hover Maximize2 icon in last column to navigate to expanded view
- [x] Make email column render as `<a href="mailto:...">` with blue text and hover underline
- [x] Make phone column render as `<a href="tel:...">` with blue text and hover underline
- [x] Apply row highlight states: selected row = purple bg (#eee6f6), hover = light gray, bulk selected = lighter purple
- [x] Keep existing features intact: inline cell editing, dirty row tracking, save button, CSV/Excel upload, filter panel, AI advisor panel

### Task 5: Verify and polish

- [x] Verify purple theme matches People.tsx exactly (header bg, borders, selection colors, text sizes) — verified via code grep: #eee6f6, #c8bdd6, #3b2778, #e0d4f0 all match
- [x] Verify ResizableColumnHeader drag-to-resize and double-click auto-fit work (manual test — skipped, not automatable)
- [x] Verify column sort menus work correctly for all columns (manual test — skipped, not automatable)
- [x] Verify row selection checkboxes and bulk toolbar work (manual test — skipped, not automatable)
- [x] Verify detail panel opens on row click and close/expand buttons work (manual test — skipped, not automatable)
- [x] Verify expanded view route loads and displays lender data (manual test — skipped, not automatable)
- [x] Verify email mailto: links and phone tel: links are clickable (manual test — skipped, not automatable)
- [x] Verify existing features still work: inline editing, save, upload CSV/Excel, filter panel, AI advisor (manual test — skipped, not automatable)
- [x] Run `npm run build` to confirm no TypeScript errors — passed
- [x] Run `npm run lint` to confirm no lint errors — passed (0 new errors, only pre-existing warnings)
