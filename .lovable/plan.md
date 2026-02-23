

## Open Specific Task from "Get on it" Button

### Problem
The "Get on it" button in the Feed right panel navigates to `/admin/evan/tasks?taskId=<id>`, but the `TaskWorkspace` component never reads the `taskId` query parameter. The user lands on the tasks page without seeing the relevant task detail.

### Solution
Add a `useEffect` in `TaskWorkspace` that reads the `taskId` query parameter on mount, finds the matching task, and auto-opens the `TaskDetailDialog` for it.

### Changes

**`src/components/evan/tasks/TaskWorkspace.tsx`**
- Add a new `useEffect` that reads `searchParams.get('taskId')`
- When a matching task is found in the loaded `tasks` array, call `handleSetSelectedTask(found)` to open the task detail dialog
- Clear the `taskId` param from the URL afterward to prevent re-triggering on subsequent renders
- Use a ref guard (similar to the existing `handledNewTaskRef`) to avoid loops

This is a small, focused change (~10 lines) in the existing effects section of TaskWorkspace.

