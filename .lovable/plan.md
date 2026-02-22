

## Fix Twilio WebSocket Timeout (31000 / 53001)

### Audit Results

**Identity consistency: PASS** -- `clx-admin` is used everywhere:
- `twilio-token/index.ts` line 157: `const identity = 'clx-admin'`
- `twilio-inbound/index.ts` line 260: `['clx-admin']` (default)
- `CallContext.tsx`: no identity filtering, accepts whatever the token returns
- No remaining references to `evan-admin` anywhere in the codebase

**No name-based gating: PASS** -- `CallContext.tsx` uses `isAdmin && !!user`, not name checks

### Root Cause: `auth.getClaims()` Failing Silently

The `twilio-token` edge function uses `supabaseAnon.auth.getClaims(token)` (line 127) to validate the JWT. This method is known to return `null` in Supabase edge functions despite receiving a valid JWT (documented in multiple community reports). When it fails:

1. Token function returns 401 "Unauthorized"
2. Frontend gets no Twilio access token
3. `new Device(token)` never runs
4. Device never reaches `registered` state
5. Inbound calls to `clx-admin` find no registered device
6. Twilio gives up after 0-2 seconds, falls through to voicemail

### Fix

**File: `supabase/functions/twilio-token/index.ts`**

Replace the fragile `getClaims` auth pattern with the proven `getUser` pattern used successfully throughout the codebase:

- Remove the `supabaseAnon` client creation (lines 120-124)
- Remove the `getClaims` call (lines 126-135)
- Replace with: create a service-role client, call `supabase.auth.getUser(token)` which reliably validates the JWT and returns the user object
- Extract `userId` from `user.id` instead of `claims.sub`
- Keep the admin role check via `user_roles` table (unchanged)
- Add logging to confirm: user ID, email, identity issued, token generation success

The rest of the function (token generation, identity, response) stays identical.

### Technical Detail

```text
BEFORE (broken):
  supabaseAnon = createClient(url, anonKey, { headers: { Authorization } })
  getClaims(token) --> returns null in edge functions --> 401

AFTER (reliable):
  supabase = createClient(url, serviceRoleKey)
  getUser(token) --> returns user object --> userId = user.id
```

### What Does NOT Change

- Identity string: stays `clx-admin`
- Inbound routing (`twilio-inbound`): already correct, no changes
- Frontend `CallContext.tsx`: already correct, no changes
- Outbound calling (`twilio-voice`): unaffected
- Admin role verification: still queries `user_roles` table
- Token generation logic (JWT signing): unchanged
- Rate limiting: unchanged

### Expected Outcome

- Token function returns 200 with valid Twilio access token
- Frontend Device registers successfully (console: "Twilio Device REGISTERED")
- Inbound calls ring for full 45-second timeout
- Popup appears immediately via synthetic SDK event
- No more WebSocket 31000/53001 errors

