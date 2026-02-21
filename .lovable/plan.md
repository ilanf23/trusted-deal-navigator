

## Fix: Prevent Logout on Tab Switch

### Problem
When switching to a different Chrome tab and returning, the app logs the user out. This happens because:

1. When the tab becomes active again, Supabase attempts to refresh the auth token in the background
2. Occasionally the refresh request fails with a transient server error (the auth logs show `"error finding user: context canceled"` -- a timeout on the server side)
3. On failure, Supabase emits a `SIGNED_OUT` event
4. The `AuthContext` reacts to `SIGNED_OUT` by clearing the user, session, and role -- which triggers the `ProtectedRoute` redirect to `/auth`

The sign-out was never intentional -- it was caused by a flaky network/server response during token refresh.

### Solution
Track whether the user explicitly called `signOut()`. When a `SIGNED_OUT` event fires from the auth listener, only clear session state if the sign-out was intentional. If it was triggered by a failed token refresh, ignore it and let Supabase retry on the next attempt.

### File Change: `src/contexts/AuthContext.tsx`

1. Add a `signOutIntentRef = useRef(false)` to distinguish user-initiated sign-outs from server-triggered ones
2. Set `signOutIntentRef.current = true` at the start of the `signOut()` function, and reset it after cleanup
3. In the `onAuthStateChange` handler, update the `SIGNED_OUT` case:
   - If `signOutIntentRef.current` is true: clear everything (current behavior)
   - If false: log a warning but do NOT clear user/session/role -- this prevents the accidental logout
4. Add a `visibilitychange` listener that attempts a gentle session recovery (`supabase.auth.getSession()`) when the tab regains focus, so that if the session is still valid in localStorage it gets restored without disruption

### What stays the same
- Explicit sign-out (clicking "Log out") continues to work normally
- Token refresh success path is unchanged
- Initial session load logic is unchanged
- All route guards and role checks remain identical

### Technical Details

The key change in the `onAuthStateChange` handler:

```text
SIGNED_OUT event received
  |
  +--> Was signOut() called intentionally?
  |      YES --> Clear user, session, role (current behavior)
  |      NO  --> Log warning, keep existing state, 
  |              attempt getSession() to silently recover
```

This is a minimal, targeted fix that addresses the root cause without changing any routing, role logic, or component structure.

