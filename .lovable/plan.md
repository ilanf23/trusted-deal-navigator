
# Module Tracker Page — Business Requirements & Development Management

## What This Page Does

The Module Tracker is a product management tool for Ilan to define, track, and monitor the business requirements and development status of each feature/module in the platform. Think of it as an internal "feature spec + progress tracker" — combining a business requirements document (BRD) with a kanban-style development pipeline view.

---

## Proposed Page Structure

The page will have **three views** selectable via tabs:

### Tab 1 — Modules Board (default view)
A card-based grid of all site modules/features. Each card shows:
- Module name + icon
- Business owner (who requested it)
- Short description (the "why")
- Status badge: `Planned | In Progress | In Review | Complete | On Hold`
- Priority badge: `Critical | High | Medium | Low`
- Progress bar (% of sub-tasks complete)
- Quick link to open the module detail

### Tab 2 — Requirements Table
A sortable/filterable table of all business requirements, each row showing:
- Requirement ID (e.g. `BR-001`)
- Module it belongs to
- Requirement description
- Acceptance criteria
- Status
- Assigned developer
- Created date

### Tab 3 — Development Pipeline (Kanban)
A Kanban board with columns:
- `Backlog → Planned → In Progress → In Review → Done`

Each card represents a module or sub-feature that can be dragged between columns (using `@dnd-kit/core` already installed).

---

## Database Schema

Three new tables:

### `modules` table
```
id (uuid, pk)
name (text)
description (text)
business_owner (text)
priority (text: critical/high/medium/low)
status (text: planned/in_progress/in_review/complete/on_hold)
icon (text - lucide icon name)
created_at (timestamptz)
updated_at (timestamptz)
```

### `business_requirements` table
```
id (uuid, pk)
module_id (uuid, fk → modules.id)
requirement_id (text - e.g. BR-001)
title (text)
description (text)
acceptance_criteria (text)
status (text: draft/approved/implemented/verified)
assigned_to (text)
priority (text)
created_at (timestamptz)
updated_at (timestamptz)
```

### `module_tasks` table (sub-tasks for progress tracking)
```
id (uuid, pk)
module_id (uuid, fk → modules.id)
title (text)
status (text: todo/in_progress/done)
created_at (timestamptz)
```

---

## Files to Create / Modify

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/pages/admin/ModuleTracker.tsx` | Main page with Tabs (Board / Requirements / Pipeline) |
| **Create** | `src/components/admin/modules/ModuleCard.tsx` | Card component for the board view |
| **Create** | `src/components/admin/modules/ModuleDetailDialog.tsx` | Dialog to view/edit a module's full details and requirements |
| **Create** | `src/components/admin/modules/RequirementsTable.tsx` | Table view of all BRs |
| **Create** | `src/components/admin/modules/ModulePipelineBoard.tsx` | Kanban drag-and-drop view |
| **Modify** | `src/App.tsx` | Add route `/superadmin/ilan/module-tracker` |
| **Modify** | `src/components/admin/AdminSidebar.tsx` | Add "Module Tracker" nav item under WOP section |
| **Database** | Migration | Create `modules`, `business_requirements`, `module_tasks` tables with RLS |

---

## Sidebar Change

In `AdminSidebar.tsx`, the Ilan top-level section currently has:
```tsx
items: [
  { title: 'WOP', url: '/superadmin/ilan', icon: Code2 },
  { title: 'Users & Roles', url: '/superadmin/ilan/users-roles', icon: Users },
]
```

It will become:
```tsx
items: [
  { title: 'WOP', url: '/superadmin/ilan', icon: Code2 },
  { title: 'Module Tracker', url: '/superadmin/ilan/module-tracker', icon: ClipboardList },
  { title: 'Users & Roles', url: '/superadmin/ilan/users-roles', icon: Users },
]
```

---

## Route Change

In `App.tsx`, inside the `<AdminRouteLayout>` Ilan block:
```tsx
<Route path="/superadmin/ilan/module-tracker" element={<EmployeeRoute employeeName="Ilan"><ModuleTracker /></EmployeeRoute>} />
```

---

## UX & Styling Notes

- Follows the existing admin page pattern: `<AdminLayout>` wrapper, card-based UI, shadcn components
- Status badges use color-coded system consistent with the bug reporting pages
- The Requirements Table uses the existing shadcn `Table` component pattern
- The Kanban board uses `@dnd-kit/core` (already installed) for drag-and-drop
- Page header includes summary stats: total modules, in-progress count, completion %, open requirements
- "Add Module" and "Add Requirement" buttons open simple dialogs with forms using `react-hook-form` + `zod`
- RLS policies: Ilan-only access (owner role gates the page via `EmployeeRoute` already)
