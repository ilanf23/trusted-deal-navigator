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
| `ai/` | 9 | AI assistant: `CLXAssistant` + chat/agent/assist modes |
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
