# Fix Undo Button: Debug Core Bug and Expand CRM Coverage

## Overview

Fix the always-inactive undo button in the admin top bar and expand undo support to cover all major CRM operations. The core issue is likely a combination of: (a) most CRM mutations never call registerUndo, and (b) the subtle inactive-to-active style change is easy to miss even when undo IS available. The fix involves debugging the core system, adding a visible undo toast, and wiring registerUndo into People, Companies, Projects, Pipeline, and expanded view mutations.

## Context

- Files involved:
  - `src/contexts/UndoContext.tsx` — core undo state management
  - `src/components/admin/AdminLayout.tsx` — undo button UI in top bar
  - `src/hooks/useTasksData.ts` — reference implementation (already has undo)
  - `src/pages/admin/EmployeeLeads.tsx` — already has undo for delete + status change
  - `src/pages/admin/EmployeePipeline.tsx` — already has undo for stage/lead changes
  - `src/pages/admin/People.tsx` — needs undo for contact type, create, bulk ops
  - `src/pages/admin/Companies.tsx` — needs undo for contact type, create
  - `src/pages/admin/Projects.tsx` — needs undo for bulk delete, assign, tags
  - `src/pages/admin/Pipeline.tsx` — needs undo for bulk delete, assign, create
  - `src/components/admin/ProjectDetailDialog.tsx` — needs undo for create/update/delete
  - `src/components/admin/PeopleExpandedView.tsx` — needs undo for inline edits, file ops
  - `src/components/admin/CompanyExpandedView.tsx` — needs undo for inline edits
  - `src/components/admin/ProjectExpandedView.tsx` — needs undo for inline edits, file ops, tasks
  - `src/components/admin/PipelineExpandedView.tsx` — needs undo for inline edits
  - `src/components/admin/UnderwritingExpandedView.tsx` — needs undo for inline edits
  - `src/components/admin/LenderManagementExpandedView.tsx` — needs undo for inline edits
- Related patterns: `useTasksData.ts` onSuccess callbacks are the reference for registerUndo usage
- Dependencies: sonner (toast library, already installed)

## Development Approach

- **Testing approach**: Manual verification via build + lint (no automated test suite in this project)
- Complete each task fully before moving to the next
- Follow the existing registerUndo pattern from useTasksData.ts: capture state before mutation, register undo in onSuccess

## Implementation Steps

### Task 1: Debug and Fix Core Undo System

**Files:**
- Modify: `src/contexts/UndoContext.tsx`

- [x] Add temporary console.log in `registerUndo` to verify it fires on mutations (e.g., task edit, lead delete)
- [x] Add temporary console.log in `useUndo` hook to detect if the no-op fallback is ever returned (would indicate a component is outside UndoProvider)
- [x] Test by triggering an existing undo-enabled operation (e.g., delete a task via useTasksData) and checking console output
- [x] If the no-op fallback IS being used: trace the component tree and fix the provider wrapping — VERIFIED: all useUndo consumers are inside UndoProvider, no wrapping issues
- [x] If registerUndo IS firing but button stays inactive: check for stale closure or re-render issues in AdminLayoutContent — VERIFIED: no stale closure issues, button correctly reads lastAction from state. Root cause: most CRM mutations never call registerUndo
- [x] Remove all debug console.logs after root cause is identified and fixed
- [x] Run `npm run build` and `npm run lint`

### Task 2: Enhance Undo UX — Toast Notification and Longer Timeout

**Files:**
- Modify: `src/contexts/UndoContext.tsx`

- [x] Increase auto-clear timeout from 30 seconds to 60 seconds
- [x] Clean up stale timeouts properly — store timeout ID in a ref so new registerUndo calls clear the previous timer (prevents race conditions with multiple rapid actions)
- [x] After calling `setLastAction`, fire a sonner toast showing the action label with an inline "Undo" action button
- [x] The toast "Undo" button calls `executeUndo` when clicked
- [x] Dismiss previous undo toast when a new action is registered (only one undo toast at a time)
- [x] Dismissing the toast does NOT clear lastAction (the top-bar button still works independently)
- [x] Run `npm run build` and `npm run lint`

### Task 3: Add Undo to People and Companies Table Mutations

**Files:**
- Modify: `src/pages/admin/People.tsx`
- Modify: `src/pages/admin/Companies.tsx`

- [ ] Import `useUndo` in People.tsx and destructure `registerUndo`
- [ ] Add registerUndo to `contactTypeMutation` — capture previous contact_type before update, restore on undo
- [ ] Add registerUndo to `createPersonMutation` — on undo, delete the created lead record
- [ ] Add registerUndo to `bulkContactTypeMutation` — capture all affected records' previous contact_types, restore on undo
- [ ] Add registerUndo to `renameContactTypeMutation` — capture affected records, restore previous contact_type values
- [ ] Import `useUndo` in Companies.tsx and destructure `registerUndo`
- [ ] Add registerUndo to `contactTypeMutation` and `createCompanyMutation` following the same pattern
- [ ] Run `npm run build` and `npm run lint`

### Task 4: Add Undo to Projects and Pipeline Table Mutations

**Files:**
- Modify: `src/pages/admin/Projects.tsx`
- Modify: `src/pages/admin/Pipeline.tsx`
- Modify: `src/components/admin/ProjectDetailDialog.tsx`

- [ ] Import `useUndo` in Projects.tsx — add registerUndo to `bulkDeleteMutation` (capture deleted projects, re-insert on undo), `bulkAddTagsMutation` (capture previous tags), and `handleBulkAssignOwner` (capture previous owners)
- [ ] Import `useUndo` in Pipeline.tsx — add registerUndo to `bulkDeleteMutation`, `bulkAssignOwnerMutation`, and `createOpportunityMutation`
- [ ] Import `useUndo` in ProjectDetailDialog.tsx — add registerUndo to `createMutation` (undo = delete), `updateMutation` (capture + restore previous values), and `deleteMutation` (undo = re-insert)
- [ ] Run `npm run build` and `npm run lint`

### Task 5: Add Undo to Expanded View Key Operations

**Files:**
- Modify: `src/components/admin/PeopleExpandedView.tsx`
- Modify: `src/components/admin/CompanyExpandedView.tsx`
- Modify: `src/components/admin/ProjectExpandedView.tsx`
- Modify: `src/components/admin/PipelineExpandedView.tsx`
- Modify: `src/components/admin/UnderwritingExpandedView.tsx`
- Modify: `src/components/admin/LenderManagementExpandedView.tsx`

- [ ] For each expanded view: import `useUndo` and add registerUndo to inline field edit handlers — capture the old field value before the Supabase update call, register undo with a restore function
- [ ] Add registerUndo to file delete operations (re-insert the lead_files record on undo)
- [ ] Add registerUndo to task toggle/create operations in ProjectExpandedView
- [ ] Add registerUndo to delete operations (project delete, appointment delete, etc.) — capture full record before delete, re-insert on undo
- [ ] Skip undo for: activity log inserts (non-destructive append-only), follow toggles (trivial to re-toggle)
- [ ] Run `npm run build` and `npm run lint`

### Task 6: Build Verification and Cleanup

- [ ] Run `npm run build` — must pass with zero errors
- [ ] Run `npm run lint` — must pass with zero errors
