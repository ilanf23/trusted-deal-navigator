---
paths:
  - "src/hooks/**/*.ts"
  - "src/hooks/**/*.tsx"
---

# Hook Conventions

- All data hooks use TanStack React Query (`useQuery` / `useMutation`)
- Query keys must be explicit arrays for proper cache invalidation (e.g., `['pipelines', pipelineId]`)
- Mutations invalidate related query keys in `onSuccess` via `queryClient.invalidateQueries`
- Dashboard hooks (useSuperAdminDashboard, useAdamsDashboard, etc.) set up Supabase real-time subscriptions — clean them up in useEffect return
- OAuth hooks (Gmail, Dropbox, Sheets) use popup window flow with `message` and `storage` event listeners
- `useTeamMember()` is the primary auth-info hook — 5-min cache, returns `isOwner` boolean
- Undo-capable mutations should register undo actions via `UndoContext`
