
# Fix: Undo Button Not Activating After Pipeline Stage Changes

## Problem
After saving stage changes (colors, names) in the Stage Manager, the undo button in the header remains grayed out/dormant instead of becoming active.

## Root Cause
The `registerUndo` call is inside `onSuccess` of the mutation, but the mutation may be silently failing due to database access policies (the update succeeds with 0 rows affected without throwing an error), or there's a timing issue with query invalidation causing a re-render that interferes with the undo state registration.

## Solution
Move the undo snapshot and registration logic to be more resilient:

1. **Capture the snapshot before the mutation starts** using the `onMutate` callback (which runs synchronously before `mutationFn`), rather than inside `mutationFn` where it's subject to stale closure issues.

2. **Use the mutation `context` pattern** from TanStack Query, which passes data from `onMutate` through to `onSuccess` and `onError` reliably.

3. **Add error logging** to surface any silent failures so we can diagnose if the save itself isn't working.

## Technical Changes

### File: `src/pages/admin/EvansPipeline.tsx`

Update the `saveStagesMutation` to use the proper TanStack Query `onMutate` -> `onSuccess` context pattern:

- **`onMutate`**: Snapshot `dbPipelineStages` (previous state) and return it as context
- **`mutationFn`**: Remove snapshot logic, just perform the database operations (update/insert/delete). Add `console.error` for any caught errors.
- **`onSuccess`**: Receive the context from `onMutate` (which contains the previous stages snapshot), compute deleted IDs from the variables, and call `registerUndo` with the restore logic
- Keep the undo `execute` function the same (re-insert deleted, restore previous values, delete newly-added)

This ensures the snapshot is taken at the right moment and passed through TanStack Query's reliable context mechanism, avoiding any stale closure or timing issues.
