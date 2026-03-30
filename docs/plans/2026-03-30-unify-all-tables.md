# Unify All Tables Across the App

## Overview

Create three shared components (UserAvatar, StatusBadge, DataTable) and migrate all listed table pages to use them, eliminating visual inconsistencies in avatars, status badges, text sizes, column widths, and row hover states across the admin and portal sections.

## Context

- Files involved:
  - Create: `src/components/shared/UserAvatar.tsx`, `src/components/shared/StatusBadge.tsx`, `src/components/shared/DataTable.tsx`
  - Migrate (admin): `Leads.tsx`, `EmployeeLeads.tsx` (was EvansLeads.tsx), `Clients.tsx`, `Contracts.tsx`, `Invoices.tsx`, `Marketing.tsx`, `AdamsPage.tsx`, `BradsPage.tsx`, `WendysPage.tsx`, `MaurasPage.tsx`, `SuperAdminDashboard.tsx`, `LenderPrograms.tsx`
  - Migrate (portal): `portal/Contracts.tsx`, `portal/Invoices.tsx`
  - Do NOT touch: `EvansPipeline.tsx`, `portal/Messages.tsx`, `RoadTo1Point5M.tsx`, CRM purple-themed tables (Companies, People, Pipeline, Projects, Underwriting, LenderManagement), `ui/table.tsx`, `ui/avatar.tsx`
- Related patterns: shadcn Table primitives in `src/components/ui/table.tsx`, shadcn Avatar in `src/components/ui/avatar.tsx`, ScrollArea in `src/components/ui/scroll-area.tsx`
- Note: `EvansLeads.tsx` referenced in prompt does not exist; the actual file is `EmployeeLeads.tsx`
- Note: CRM pages (DealsPage, BorrowersPage, LendersPage) do not exist - nothing to migrate there

## Development Approach

- Presentation-only changes: do NOT modify data fetching, filtering, search, sorting, or business logic
- Build shared components first, then migrate pages incrementally
- Each task should leave the app in a buildable state
- No automated test suite exists, so verification is via `npm run build` (zero TS errors) and `npm run lint`

## Implementation Steps

### Task 1: Create shared components

**Files:**
- Create: `src/components/shared/UserAvatar.tsx`
- Create: `src/components/shared/StatusBadge.tsx`
- Create: `src/components/shared/DataTable.tsx`

- [x] Create `src/components/shared/` directory
- [x] Create `UserAvatar.tsx`: wraps shadcn Avatar/AvatarImage/AvatarFallback, accepts `src?`, `name`, `size?: 'sm' | 'md'` (sm=h-8 w-8, md=h-10 w-10), rounded-full, bg-muted fallback with uppercase initials, no gradients
- [x] Create `StatusBadge.tsx`: accepts `status` string and `variant?: 'subtle' | 'solid'` (default subtle). Single STATUS_COLORS map covering: new, contacted, qualified, negotiation, won, lost, active, inactive, pending, paid, overdue, draft, sent, signed, expired, cancelled, viewed, initial_review, underwriting, closing, funded, dead, on_hold, needs_attention, dormant, under_review, countered, pending_response, complete, in_review, high, medium, low, hot, warm, cold. Subtle = light bg + colored text; solid = solid bg + white text. Sizing: px-2.5 py-0.5 rounded-full text-xs font-medium. Unknown statuses fall back to gray.
- [x] Create `DataTable.tsx`: generic component with `Column<T>` config (key, header, width?, align?, render?), `data: T[]`, `onRowClick?`, `activeRowId?`, `emptyState?`, `className?`. Enforces: px-4 py-3 cell padding, text-sm cells, text-xs font-medium text-muted-foreground uppercase tracking-wider headers, hover:bg-muted/50 rows, border-b border-border rows, bg-accent/5 active row, ScrollArea wrapper. Uses shadcn Table primitives internally.
- [x] Run `npm run build` to confirm shared components compile

### Task 2: Migrate simple admin pages (Clients)

**Files:**
- Modify: `src/pages/admin/Clients.tsx` (~120 lines)

- [ ] Replace inline shadcn Table markup with `<DataTable>` and column config array
- [ ] Preserve search input, data fetching (useQuery), and all existing functionality
- [ ] Run `npm run build` to confirm zero errors

### Task 3: Migrate portal pages

**Files:**
- Modify: `src/pages/portal/Contracts.tsx` (~63 lines)
- Modify: `src/pages/portal/Invoices.tsx` (~57 lines)

- [ ] Replace inline shadcn Table + statusColors in portal/Contracts.tsx with `<DataTable>` + `<StatusBadge>`
- [ ] Replace inline shadcn Table + statusColors in portal/Invoices.tsx with `<DataTable>` + `<StatusBadge>`
- [ ] Preserve action buttons (View link in Contracts) via column render functions
- [ ] Remove per-page statusColors objects
- [ ] Run `npm run build`

### Task 4: Migrate admin Contracts and Invoices

**Files:**
- Modify: `src/pages/admin/Contracts.tsx` (~313 lines)
- Modify: `src/pages/admin/Invoices.tsx` (~319 lines)

- [ ] Replace inline shadcn Table in Contracts.tsx with `<DataTable>`, use `<StatusBadge>` for status column, preserve action buttons (View, Send, Mark Paid) and create/view modals via render functions
- [ ] Replace inline shadcn Table in Invoices.tsx with `<DataTable>`, use `<StatusBadge>` for status column, preserve action buttons and create modal
- [ ] Remove per-page statusColors objects
- [ ] Run `npm run build`

### Task 5: Migrate Leads.tsx

**Files:**
- Modify: `src/pages/admin/Leads.tsx` (~849 lines)

- [ ] Replace inline table markup with `<DataTable>`, using render functions for: status dropdowns, owner dropdowns, touchpoint icons, avatar/name cell
- [ ] Use `<UserAvatar>` for lead name cells (if avatar pattern exists) or keep name-only cell
- [ ] Use `<StatusBadge>` in status filter pills and any inline status display
- [ ] Preserve: resizable columns (ResizableColumnHeader), split-view detail panel, onRowClick -> activeRowId, status/owner filtering, text search, communication history
- [ ] Remove inline statusConfig map
- [ ] Run `npm run build`

### Task 6: Migrate EmployeeLeads.tsx

**Files:**
- Modify: `src/pages/admin/EmployeeLeads.tsx` (~50 KB)

- [ ] Replace inline table markup with `<DataTable>` + `<StatusBadge>` where applicable
- [ ] Preserve transcript expansion and any employee-specific functionality
- [ ] Remove inline status color logic
- [ ] Run `npm run build`

### Task 7: Migrate employee dashboard pages

**Files:**
- Modify: `src/pages/admin/AdamsPage.tsx` (~238 lines)
- Modify: `src/pages/admin/BradsPage.tsx` (~249 lines)
- Modify: `src/pages/admin/WendysPage.tsx` (~236 lines)
- Modify: `src/pages/admin/MaurasPage.tsx` (~241 lines)

- [ ] AdamsPage: convert both tables (Lender Activity + Pending Term Sheets) to `<DataTable>`, replace getStatusColor with `<StatusBadge>`. Preserve metric cards and progress bars.
- [ ] BradsPage: convert High-Value Deals table to `<DataTable>`, replace stage/probability badges with `<StatusBadge>`. Preserve non-table cards (Meetings, Referrals, Goals).
- [ ] WendysPage: convert Client Follow-ups table to `<DataTable>`, replace priority/stage badges with `<StatusBadge>`. Preserve Communications card and Daily Targets.
- [ ] MaurasPage: convert Document Processing Queue table to `<DataTable>`, replace status/priority badges with `<StatusBadge>`. Preserve Recent Activity card and progress bars.
- [ ] Remove all per-page getStatusColor/getPriorityColor helper functions
- [ ] Run `npm run build`

### Task 8: Migrate Marketing.tsx

**Files:**
- Modify: `src/pages/admin/Marketing.tsx` (~423 lines)

- [ ] Convert both table sections (Performance by Source + Leads from Source) to `<DataTable>`
- [ ] Replace inline status badges with `<StatusBadge>`
- [ ] Preserve all Recharts visualizations, stats cards, source filtering, and navigation
- [ ] Remove inline statusColors
- [ ] Run `npm run build`

### Task 9: Migrate SuperAdminDashboard.tsx

**Files:**
- Modify: `src/pages/admin/SuperAdminDashboard.tsx` (~500+ lines)

- [ ] Convert Pipeline by Stage table and any other table sections to `<DataTable>`
- [ ] Replace inline status/confidence badges with `<StatusBadge>` where applicable
- [ ] Preserve revenue metrics, confidence banner, time period selector, and all dashboard functionality
- [ ] Run `npm run build`

### Task 10: Standardize LenderPrograms.tsx styling

**Files:**
- Modify: `src/pages/admin/LenderPrograms.tsx` (~600+ lines)

- [ ] Keep its COLUMNS config approach and inline editing - do NOT convert to DataTable
- [ ] Standardize visual styling to match: text-sm cells, consistent padding (px-4 py-3), text-xs uppercase headers
- [ ] Use `<StatusBadge>` if any status columns exist
- [ ] Preserve inline editing, XLSX import/export, filtering, scroll behavior, and all special features
- [ ] Run `npm run build`

### Task 11: Final cleanup and verification

**Files:**
- All migrated files from Tasks 2-10

- [ ] Scan all migrated files for leftover dead code: unused statusColors/getStatusColor/getPriorityColor/statusConfig, unused inline avatar divs, unused imports
- [ ] Remove any dead code found
- [ ] Run `npm run build` - must produce zero TypeScript errors
- [ ] Run `npm run lint` - fix any lint errors introduced by the migration

## Post-Completion

- Manually check that each migrated page still renders correctly with its data, filters, search, and actions working as before
- Confirm visual consistency: open multiple tables side by side and verify avatars, badges, text sizes, padding, and column spacing all match
- Update CLAUDE.md if the shared component patterns should be documented
- Move this plan to `docs/plans/completed/`
