

## Fix: Make Twilio Device Persistent Across ALL Routes

### Root Cause

The `CallProvider` (which initializes and manages the Twilio Device) is nested inside `EvanPortalWrapper`, which only mounts when Evan is on `/admin/evan/*` routes. If he navigates to any other page -- `/superadmin/*`, the homepage, or anywhere else -- the `CallProvider` unmounts, the Twilio Device is destroyed, and inbound calls immediately fail because no browser client is registered to receive them.

Database evidence: ALL calls today have `frontend_ack_at: null` and zero frontend SDK events. The device was never registered when calls arrived.

### Fix

Move the `CallProvider` and `IncomingCallPopup` to the **App level** (inside BrowserRouter + AuthProvider) so the Twilio Device stays registered on every page. The CallProvider already gates initialization on `isAdmin && !!user`, so it only activates for admin users -- no behavior change for non-admins.

### Changes

**File: `src/App.tsx`**

- Import `CallProvider` from `@/contexts/CallContext` and `IncomingCallPopup` from `@/components/evan/IncomingCallPopup`
- Wrap the `<Routes>` block with `<CallProvider>` (must be inside `<BrowserRouter>` because it uses `useNavigate`/`useLocation`, and inside `<AuthProvider>` because it uses `useAuth`)
- Add `<IncomingCallPopup />` as a sibling to `<Routes>` so the popup renders on every page

**File: `src/components/evan/EvanPortalWrapper.tsx`**

- Remove `CallProvider` wrapper and `IncomingCallPopup` from this component
- Keep `DraftProvider` and `EvanUIStateProvider` (those are Evan-specific UI state, not call-related)

### What This Fixes

- Twilio Device registers once when Evan logs in and stays registered across all page navigation
- Inbound calls will trigger the popup on ANY page (dashboard, pipeline, gmail, superadmin, etc.)
- No more instant call failures when Evan isn't on `/admin/evan/*` routes
- Outbound calling continues to work from any admin page

### What Stays the Same

- Only admin users get the Twilio Device (gated by `isAdmin && !!user`)
- The token edge function still verifies admin role server-side
- DraftProvider and EvanUIStateProvider remain scoped to Evan's routes
- All existing call event logging, health monitoring, and keep-warm logic unchanged

