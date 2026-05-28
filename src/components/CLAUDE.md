# Components

~270 React components organized into 11 subdirectories. UI primitives in `ui/`, feature components in role-specific folders.

## Directory Overview

| Directory | Files | Purpose |
|-----------|-------|---------|
| `ui/` | 61 | shadcn/ui primitives (Radix + Tailwind). **Do not heavily modify.** |
| `admin/` | 105 | Admin portal: CRM, pipeline, inbox, dropbox, sheets, dashboards |
| `evan/` | 25 | Sales rep (Evan) portal: dashboard, Gmail, tasks |
| `home/` | 10 | Public landing page sections (Hero, Stats, Testimonials, CTA) |
| `layout/` | 3 | Public site wrappers: `PublicLayout`, `Header`, `Footer` |
| `auth/` | 1 | `ProtectedRoute` — route guard |
| `ai/` | 6 | AI assistant: `CLXAssistant` chat panel |
| `gmail/` | 9 | Gmail integration: inbox, email list/detail, compose, connect |
| `feed/` | 4 | Activity feed: `FeedCenter`, left/right panels, `ActivityCard` |
| `partner/` | 4 | Partner portal: layout, routing, sidebar |
| `portal/` | 2 | Client portal: `PortalLayout`, `PortalSidebar` |

Root file: `NavLink.tsx` — React Router NavLink wrapper.

## Common Patterns

### UI Library (ui/)
All shadcn/ui components follow: Radix primitive + `cva` variants + `React.forwardRef` + Tailwind styling. Export both the component and its `*Variants` function.

### Detail/Expanded View Pattern (admin/)
List pages have companion expanded views accessed via `/expanded-view/:id` routes. These render tabbed interfaces with collapsible sections and inline editing.

### Widget Pattern (evan/)
Self-contained card components that fetch their own data via React Query, manage internal filter/view state, and include action buttons/dialogs.

### Layout Wrapper Pattern
`AdminLayout`, `EvanLayout`, `PortalLayout`, `PartnerLayout` combine context providers + sidebar + floating UI elements (chat, inbox, bug reports). `EvanLayout` wraps `AdminLayout` to persist Twilio call state.

## Dependencies Between Folders

- `ui/` — foundation layer, no dependencies on feature folders
- `admin/` — imports from `ui/`, heavily interconnected internally
- `evan/` — imports from `ui/` and `admin/` (EvanLayout wraps AdminLayout)
- `home/`, `layout/` — import from `ui/` only, self-contained
- `gmail/` — split across `gmail/`, `admin/inbox/`, and `evan/gmail/`
- `ai/` — imports from `ui/` and `admin/`

## Table row contract (record/list tables)

Every record-table body row renders as **one visual line at rest**, with one
consistent vertical padding per density. Long content truncates with an
ellipsis and exposes the full value via `title=`; the detail panel remains
authoritative for rich content.

**Primitives** — `src/components/shared/singleLineCell.tsx`:
- `SINGLE_LINE_CELL` — apply to a `<td>` or `<TableCell>`. Prevents wrapping, clips overflow.
- `SINGLE_LINE_CONTENT` — apply to the direct text child inside a single-line cell. Allows shrink + truncate.
- `SINGLE_LINE_CHIP` — apply to chips/badges/dates/action groups. Prevents shrinking and wrapping.
- `<SingleLineCellContent title={value}>{value}</SingleLineCellContent>` — wrapper for unbounded string values.
- `RECORD_TABLE` — descendant-selector class for a shadcn `<Table>`: applies the contract to every body cell in one shot.

**Patterns by table type:**
- shadcn `<Table>`: add the descendant selector to the `<Table>` className — `[&_tbody_td]:overflow-hidden [&_tbody_td]:whitespace-nowrap`. Already wired into `DataTable` by default (use `multiLine: true` on a column to opt out).
- Native CRM tables (Pipeline, People, Companies, Projects, LoanVolumeLog, LenderPrograms): every body `<td>` already carries `overflow-hidden whitespace-nowrap` (or `SINGLE_LINE_CELL`). Inner pills already truncate.
- Tags / multi-value cells: render first N + "+N overflow" pill, never `flex-wrap`. Full list goes in `title=`.

**Intentional two-line cells** (Tasks, Newsletter campaigns, TopActions, RateWatch borrower/property):
- The secondary line is preserved by design.
- Always render the second line — fall back to `' '` so rows are uniform height even when the secondary value is absent.
- Both lines use `truncate` + `title=`.
- The td still gets `overflow-hidden` and (where safe) `whitespace-nowrap`; block-level `<p>`/`<div>` children stack normally and aren't affected by nowrap.

**Persisted column widths** — `useAutoFitColumns`:
- Saved widths are clamped to `[minWidth, MAX_PERSISTED_WIDTH=2000]` so a stale narrow value can't induce wrap.
- Storage key is internally suffixed with a version (`:v2`). Bump it when persisted-width semantics change so users get a one-time reset instead of silent migration.

**Opt-out:** settings matrices, public-page content, and email body cells are not record-table data rows — leave them alone. New table work should default to the contract; document any deliberate exception inline.
