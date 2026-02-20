

# Fix: Random Logout Every ~2 Minutes

## Root Cause

The `AuthContext` has a **stale closure bug** in the `onAuthStateChange` listener. The listener captures `userRole` at mount time (always `null`), so the check `!userRole` on line 72 is always `true`. This means:

1. Every `SIGNED_IN` event (which Supabase can emit on reconnections, tab visibility changes, or token refreshes in some versions) triggers `setRoleLoading(true)`, putting the app back into a loading state.
2. If a `TOKEN_REFRESHED` event fires shortly after, it sets `roleLoading = false` and `loading = false` **before** the `setTimeout`-deferred role fetch completes.
3. At that moment: `loading = false`, `userRole = null` (stale), `isAdmin = false`.
4. `ProtectedRoute` sees a logged-in user with no admin role and redirects away -- appearing as a "logout."

This race between overlapping auth events creates a brief window where the role is unknown but loading is false, causing incorrect redirects.

## Solution

Use a `useRef` to track the fetched role, eliminating the stale closure. Add a guard so that once the role is known, subsequent `SIGNED_IN` or `TOKEN_REFRESHED` events don't re-enter the loading state or clear the role.

## Changes

### File: `src/contexts/AuthContext.tsx`

1. Add a `useRef<UserRole | null>` (`roleRef`) that mirrors the role state, accessible inside the listener without stale closure issues.
2. In the `SIGNED_IN` handler: only re-fetch the role if `roleRef.current` is `null` (first sign-in). If role is already known, skip the re-fetch entirely.
3. In the `TOKEN_REFRESHED` handler: never clear `userRole` -- just silently update session/user. Only set `loading = false` if it was still `true`.
4. After `fetchUserRole` resolves (both in the listener and `getSession` path), write to `roleRef.current` alongside `setUserRole`.
5. Remove the `setTimeout` wrapper around the role fetch in the `SIGNED_IN` handler and use a plain async call with `Promise.resolve().then(...)` (microtask) instead, to reduce the window for race conditions.

### Summary of the fix logic:

```text
Before (buggy):
  SIGNED_IN → always re-fetches role (stale closure)
  TOKEN_REFRESHED → sets loading=false (before role fetch finishes)
  Result: brief window with loading=false + userRole=null → redirect

After (fixed):
  SIGNED_IN → only fetches role if roleRef.current is null
  TOKEN_REFRESHED → silently updates session, preserves existing role
  Result: role is never lost, no spurious redirects
```

This is a single-file fix to `src/contexts/AuthContext.tsx` with no new dependencies.

