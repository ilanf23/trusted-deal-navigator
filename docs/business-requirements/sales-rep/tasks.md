# Tasks

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/tasks`
**Source file:** `src/pages/admin/Tasks.tsx` (wraps `TaskWorkspace`)
**Last reviewed:** 2026-05-11

---

## Purpose

The rep's to-do hub for everything that isn't a meeting or a call — follow-ups, document chases, internal hand-offs. Acts as the daily worklist; saved filters let each rep slice it by lead, status, or priority.

## Primary user

Sales rep planning their day and clearing items between calls. Secondary: founders auditing what each rep is working on, ops creating tasks on behalf of others.

## Entry points

- Sidebar nav: **Workflow → Tasks**
- Lead detail panel → *Add task* → task appears here
- Deep link via `?filterId=...` from saved filter shares

## What the user can do here

- See all tasks assigned to the current rep (or filtered set)
- Create a new task linked to a lead
- Mark tasks `todo` / `in_progress` / `done`
- Edit task title, due date, priority, assignee
- Save/share/duplicate custom filters (public or private)
- Set a default filter so the page opens with it pre-applied

## Key business rules

- All task status values are exactly `todo`, `in_progress`, `done` (enum)
- Assignment uses `team_member_id` (FK to `users`) — never names
- Every change writes a row to `task_activities` for an audit trail
- Saved filters can be public (shared with all admins) or private (per-user)
- Only the creator can delete a private filter; public filters require admin permission

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Task title | `tasks.title` | |
| Status | `tasks.status` | `todo` / `in_progress` / `done` |
| Due date | `tasks.due_at` | |
| Priority | `tasks.priority` | |
| Assignee | `tasks.team_member_id` → `users.name` | |
| Linked lead | `tasks.lead_id` → `potential.name` | Click-through to lead |

## User flows

### 1. Create a task from a lead
1. From a lead detail panel, click *Add task*
2. Fill in title, due date, priority
3. Save → row appears in Tasks list and in the lead's activity feed

### 2. Build and save a custom filter
1. Click *Filter* → adjust criteria in drawer
2. Save → name it → choose public/private
3. Filter appears in the sidebar; URL updates with `?filterId=...`

### 3. Clear today's worklist
1. Apply *Due today* filter
2. Walk down list, hit ✓ on each task as complete
3. Each completion writes a `task_activities` row

## Edge cases & known gaps

- Bulk operations (e.g. complete N tasks) not yet supported
- No recurring tasks
- Overdue tasks stay visible indefinitely — no auto-archive
- Saved filter sharing has no per-user permissions beyond public/private
- Reassigning a task doesn't notify the new assignee

---

## Technical anchors

### Components used
- `src/components/employee/tasks/TaskWorkspace.tsx` — main UI
- `src/components/admin/SavedFiltersSidebar.tsx`
- `src/components/employee/tasks/savedFilters/TaskFilterDrawer.tsx`

### Hooks / contexts
- `useTasksData` — list + mutations
- `useSavedTaskFilters` — filter CRUD
- `useEmployeeUIState` — persists sidebar open + active filter id per user
- `useAdminTopBar`, `usePageDatabases`

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `tasks` | ✓ | ✓ |
| `task_activities` | — | ✓ |
| `task_saved_filters` | ✓ | ✓ |
| `potential` | ✓ | — |

### Edge functions
- None — direct Supabase

### Permissions
- Route gate: `AdminRoute`
- RLS: reps see their own + tasks assigned to them; founders see all

## Open questions

- [ ] Recurring tasks (weekly check-in style)?
- [ ] Notify assignee on reassignment?
- [ ] Bulk complete / bulk reassign?
- [ ] Auto-archive done tasks past N days?
