

## Fix: Call Error Toast Spam After Idle Session

### Root Cause Analysis

After leaving the app idle for hours, three things collide:

1. **The Twilio token expires** -- the device fires an `error` event (code 20104 or similar)
2. **The keep-warm interval (every 30s)** sees the device is not `'registered'` and calls `device.register()` -- but doesn't check if the device is already in the `'registering'` state, causing the `InvalidStateError: Attempt to register when device is in state "registering"`
3. **Every error triggers an unthrottled `toast.error()`** on line 282, so each failed re-register attempt produces a visible toast -- creating a flood of error popups every second

The error handler for token expiry (lines 269-280) tries to destroy and re-init, but the keep-warm interval races against it, calling `register()` on a device that's mid-initialization.

### Changes (single file: `src/contexts/CallContext.tsx`)

#### 1. Add a `isReinitializingRef` guard

Prevent concurrent initialization attempts from the keep-warm interval, token-expiry handler, and eager-init effect:

```typescript
const isReinitializingRef = useRef(false);
```

- Set `true` at start of `initializeTwilioDevice`, `false` at end (in `finally`)
- Early-return if already `true`

#### 2. Fix keep-warm interval to check for `'registering'` state

Current code (line 365):
```typescript
if (deviceRef.current.state !== 'registered') {
  deviceRef.current.register()
```

Change to:
```typescript
if (deviceRef.current.state === 'unregistered') {
  deviceRef.current.register()
```

This skips re-registration when the device is already in `'registering'` or `'destroying'` states, preventing the `InvalidStateError`.

#### 3. Throttle error toasts

Add a `lastErrorToastRef` timestamp and only show an error toast if 10+ seconds have passed since the last one:

```typescript
const lastErrorToastRef = useRef<number>(0);

// In error handler:
const now = Date.now();
if (now - lastErrorToastRef.current > 10000) {
  lastErrorToastRef.current = now;
  toast.error(`Call error: ${error.message}`);
}
```

#### 4. Guard the token-expiry re-init path

Before calling `initializeTwilioDevice()` in the token-expiry timeout (line 278-280), check `isReinitializingRef` to avoid racing with the keep-warm interval.

#### 5. Add backoff to keep-warm when device is absent

When `deviceRef.current` is null (line 373-375), the current code calls `initializeTwilioDevice()` every 30 seconds unconditionally. Add the `isReinitializingRef` guard here too.

### Summary of Changes

| Problem | Fix |
|---|---|
| `register()` called while already registering | Only call when state is `'unregistered'` |
| Concurrent re-init from multiple paths | `isReinitializingRef` mutex guard |
| Toast spam (every error = toast) | 10-second throttle via timestamp ref |
| Token-expiry handler races with keep-warm | Both check the reinitializing guard |

### Files Modified

- `src/contexts/CallContext.tsx`

No database, edge function, or other file changes needed.

