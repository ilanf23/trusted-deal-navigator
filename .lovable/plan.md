

# Fix: Stop Portal Pages from Refreshing Every ~10 Seconds

## Problem

Every time the authentication token refreshes (which Supabase does automatically in the background), the entire page unmounts and remounts. Here's the chain of events:

1. Supabase fires an `onAuthStateChange` event (e.g., `TOKEN_REFRESHED`)
2. `AuthContext` sets `roleLoading = true`, which makes `loading = true`
3. `ProtectedRoute` and `EmployeeRoute` both check `loading` -- when it's `true`, they render a spinner instead of the page content
4. This **unmounts** the entire page (destroying all local state, scroll position, open dialogs, etc.)
5. A moment later, the role finishes loading, `loading` becomes `false`, and the page remounts from scratch

This creates the "page refresh" effect you're experiencing.

## Solution

Skip the role re-fetch on token refresh events. The user's role doesn't change when a token refreshes -- it only matters on initial sign-in. We'll update `AuthContext` to:

- Only set `roleLoading(true)` during the initial session load
- On `TOKEN_REFRESHED` and other non-sign-in events, update the session/user silently **without** re-fetching the role or flashing a loading state
- Cache the role once it's known and only re-fetch on actual sign-in/sign-out events

## Technical Details

**File: `src/contexts/AuthContext.tsx`**

Update the `onAuthStateChange` handler to check the event type:

```tsx
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);

  // Only re-fetch role on actual sign-in, not token refreshes
  if (event === 'SIGNED_IN' && !userRole) {
    setRoleLoading(true);
    setTimeout(async () => {
      const role = await fetchUserRole(session!.user.id);
      setUserRole(role);
      setRoleLoading(false);
      setLoading(false);
    }, 0);
  } else if (event === 'SIGNED_OUT') {
    setUserRole(null);
    setRoleLoading(false);
    setLoading(false);
  } else if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
    // Don't re-fetch role, just update session silently
    if (!session?.user) {
      setUserRole(null);
    }
    setRoleLoading(false);
    setLoading(false);
  }
});
```

This is a single-file change that will eliminate the periodic page refreshes entirely while keeping authentication working correctly.

