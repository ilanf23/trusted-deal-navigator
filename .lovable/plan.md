

## Fix: Page Refresh Redirects Users to Homepage

### Root Cause

There is a one-render race condition in `useTeamMember`. When auth finishes loading and `user` transitions from `null` to a valid user, React Query's `enabled: !!user` flips to `true` -- but the fetch hasn't started yet. During that single render frame:

- `isLoading` = `false` (React Query hasn't begun fetching)
- `teamMember` = `null` (no data yet)

`EmployeeRoute` interprets this as "user is not a team member" and redirects to `/user`, which then bounces the admin user elsewhere. This cascade ultimately lands the user on the homepage or login page.

### The Fix (1 file)

**`src/hooks/useTeamMember.ts`** -- Change the `loading` return value to account for the gap between auth resolving and the team member query actually fetching:

```text
Current:
  const loading = isLoading

Proposed:
  const loading = isLoading || (!!user && !isFetched)
```

By destructuring `isFetched` from `useQuery` and including it in the loading calculation, we ensure that `loading` remains `true` until the query has actually completed at least once. This closes the one-render gap entirely.

### Why This Works

- `isFetched` is `false` until React Query has completed the first fetch
- When `user` exists but the query hasn't run yet, `!!user && !isFetched` is `true`, keeping `loading = true`
- Both `ProtectedRoute` and `EmployeeRoute` consume `useTeamMember().loading`, so both are protected by this single fix
- After the query completes (even if `teamMember` is `null` for non-team-members), `isFetched` becomes `true` and loading correctly resolves to `false`

### Technical Detail

No other files need changes. The `ProtectedRoute` and `EmployeeRoute` already correctly gate on `teamLoading` -- the only problem was that `teamLoading` briefly reported `false` before the query had a chance to start.

