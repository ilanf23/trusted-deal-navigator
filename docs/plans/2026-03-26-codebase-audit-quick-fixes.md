# Codebase Audit - Quick Fixes & Blockers

## Overview
Filtered version of the full codebase audit (`2026-03-26-codebase-audit-remediation.md`). Contains only simple fixes (quick wins) and blocking issues that must be resolved before continuing other development work. Complex refactors, performance optimizations, and UX enhancements are deferred.

## Context
- Source plan: `docs/plans/2026-03-26-codebase-audit-remediation.md`
- Files involved: Edge functions in `supabase/functions/`, auth/routing in `src/App.tsx` + `src/contexts/AuthContext.tsx`, `src/contexts/CallContext.tsx`
- Related patterns: Supabase RLS, ProtectedRoute/AdminRoute/EmployeeRoute guards
- Dependencies: Supabase, Twilio

## Development Approach
- Fix blocking issues first (Phase 1), then security fixes (Phase 2), then cleanup (Phase 3)
- Each task should be tested manually after completion
- Edge function changes require deployment to staging before production
- **No automated test suite exists** - manual verification required

## Deferred Items (not in this plan)
These tasks from the full audit are deferred for later:
- Task 9: google-sheets-api authorization (needs ownership model design)
- Task 10: dropbox-api authorization (needs ownership model design)
- Task 11: Dropbox OAuth state parameter (needs crypto token generation + server-side storage)
- Task 14: Route-level code splitting (large refactor, 97+ routes)
- Task 16: CSRF token validation (evaluate after CORS fix lands)
- Task 17: N+1 query patterns (large refactor across 3 complex components)
- Task 18: PII in email notifications (needs redaction strategy decision)
- Task 19: Consolidate duplicate utilities (refactoring, not blocking)
- Task 20: Consolidate duplicate types (refactoring, not blocking)
- Task 21: Search input debouncing (performance, not blocking)
- Task 23: Accessibility attributes (large scope, not blocking)
- Task 25: Lazy-load heavy dependencies (performance optimization)
- Task 26: Loading skeletons (UX enhancement)
- Task 27: Standardize edge function error responses (touches all edge functions)
- Task 28: Environment variable validation (nice to have)

---

## Phase 1: Blocking Issues

These must be fixed first - they affect app stability and are prerequisites for other work.

### Task 1: Fix Wildcard CORS on All Edge Functions

**Severity:** CRITICAL - Security (Blocker)
**Why blocking:** Every edge function is vulnerable. Fixing this first means all subsequent edge function changes include proper CORS from the start.

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Modify: All `supabase/functions/*/index.ts` files (15+ files)

**Details:**
Every edge function independently declares `'Access-Control-Allow-Origin': '*'`. No shared CORS config exists.

- [ ] Create `supabase/functions/_shared/cors.ts` with origin allowlist (production domain + localhost for dev)
- [ ] Export a function that returns validated CORS headers based on request origin
- [ ] Replace hardcoded `'*'` in all edge functions with the shared CORS utility
- [ ] Test preflight (OPTIONS) requests still work correctly
- [ ] Verify OAuth callback flows still function (Gmail, Sheets, Dropbox, Calendar)

---

### Task 2: Add Error Boundary Around CallProvider

**Severity:** CRITICAL - Stability (Blocker)
**Why blocking:** One Twilio SDK error = white screen for all users. CallProvider wraps the entire app with no error boundary.

**Files:**
- Create: `src/components/CallErrorBoundary.tsx`
- Modify: `src/App.tsx` (wrap CallProvider)

- [ ] Create a CallErrorBoundary component that catches errors and shows fallback UI
- [ ] Wrap `CallProvider` in `App.tsx` with the error boundary
- [ ] Add recovery mechanism (retry button to reinitialize Twilio)
- [ ] Verify calling still works after adding the boundary

---

### Task 3: Fix Unhandled Promise Rejections in AuthContext

**Severity:** CRITICAL - Stability (Blocker)
**Why blocking:** Auth is foundational. Silent failures here corrupt session state for all users.

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (3 unhandled .then() chains at lines ~105, ~126, ~149)

**Details:**
Three `supabase.auth.getSession().then(...)` calls have no `.catch()` handler. Network errors cause unhandled promise rejections and potentially leave `loading` stuck at `true`.

- [ ] Add `.catch()` handlers to all three `.then()` chains
- [ ] Ensure `setLoading(false)` is called in catch blocks so the app doesn't hang
- [ ] Add `console.error` for failed session recovery (keep these - they're genuine errors)

---

## Phase 2: Simple Security Fixes

Quick security patches - each is a focused, small change.

### Task 4: Wrap Unprotected OAuth Callback Routes with AdminRoute

**Severity:** CRITICAL - Auth Bypass
**Effort:** ~15 minutes

**Files:**
- Modify: `src/App.tsx` (lines ~205, ~211-213)

**Details:**
Four `/admin` callback routes are NOT wrapped in `<AdminRoute>`:
- `/admin/sheets-callback`
- `/admin/dropbox/callback`
- `/admin/inbox/callback`
- `/admin/calendar-callback`

- [ ] Wrap all four callback routes with `<AdminRoute>` component
- [ ] Verify OAuth flows still complete correctly after adding the wrapper

---

### Task 5: Fix SQL Pattern Injection in twilio-transcription

**Severity:** CRITICAL (mitigated) - The phone number is digit-stripped, so SQL injection is not possible, but empty input would match all records via `ilike.%%`.

**Files:**
- Modify: `supabase/functions/twilio-transcription/index.ts` (line ~90)

- [ ] Add guard: skip the ilike query if `normalizedPhone` is empty after digit-stripping
- [ ] Consider using `.eq()` with exact match instead of pattern matching

---

### Task 6: Fix Dynamic Table Name Injection in ai-agent-executor

**Severity:** CRITICAL - SQL Injection
**Effort:** ~30 minutes

**Files:**
- Modify: `supabase/functions/ai-agent-executor/index.ts` (undo/redo functions)

**Details:**
`target_table` from DB records is passed directly to `.from(target_table)` with service-role key. If a malicious row were inserted, it could target any table.

- [ ] Create an allowlist of valid table names (e.g., `['leads', 'contracts', 'invoices', ...]`)
- [ ] Validate `target_table` against allowlist before executing any DB operation
- [ ] Return error if table name is not in allowlist

---

### Task 7: Add Authorization Checks to ai-agent-executor Undo/Redo

**Severity:** CRITICAL - Privilege Escalation
**Effort:** ~30 minutes

**Files:**
- Modify: `supabase/functions/ai-agent-executor/index.ts` (undo/redo functions)

**Details:**
`undoChange()` passes `userId` but never checks ownership. `redoChange()` doesn't even accept `userId`.

- [ ] Add ownership check in `undoChange`: verify `change.user_id === userId`
- [ ] Add `userId` parameter to `redoChange` and verify ownership
- [ ] Return 403 error if user doesn't own the change

---

### Task 8: Fix Open Redirect Vulnerabilities

**Severity:** CRITICAL - Security
**Effort:** ~30 minutes

**Files:**
- Modify: `src/hooks/useGmailConnection.ts` (line ~213)
- Modify: `src/hooks/useGmail.ts` (line ~87)

**Details:**
`window.location.href = data.url` used without validating the URL comes from a trusted domain. Note: `InboxCallback.tsx` uses React Router's `navigate()` which is constrained to same-origin, so it's lower risk.

- [ ] Create a URL validation utility that checks against allowlisted domains (accounts.google.com, api.dropbox.com, etc.)
- [ ] Validate `data.url` before assigning to `window.location.href` in both hooks
- [ ] Log and reject URLs that don't match the allowlist

---

### Task 9: Change Rate Limiting to Fail-Closed

**Severity:** IMPORTANT - Security
**Effort:** ~20 minutes

**Files:**
- Modify: `supabase/functions/_shared/rateLimit.ts` (lines ~52-54, ~78-80)

**Details:**
Two locations explicitly return `null` (allow) on DB errors. During a DB outage, rate limiting is completely disabled.

- [ ] Change both error paths to return a rate-limit error response instead of `null`
- [ ] Log rate limit DB failures as critical alerts

---

## Phase 3: Simple Cleanup

Quick code quality fixes that reduce confusion and information leakage.

### Task 10: Remove Dead super_admin Role References

**Severity:** IMPORTANT - Dead Code / Auth Confusion
**Effort:** ~15 minutes

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (3 references: type definition, role check, isAdmin check)

**Details:**
The `app_role` enum only has `admin`, `client`, `partner`. The `super_admin` role doesn't exist in the DB. Founders are identified by `is_owner` on `team_members`, not by role.

- [ ] Remove `'super_admin'` from the `UserRole` type union
- [ ] Remove the `if (roles.includes('super_admin'))` check in role resolution
- [ ] Remove `userRole === 'super_admin'` from `isAdmin` check
- [ ] Verify no RLS policies reference `super_admin`

---

### Task 11: Fix Hardcoded Team Member UUID

**Severity:** IMPORTANT - Maintainability
**Effort:** ~20 minutes

**Files:**
- Modify: `supabase/functions/call-to-lead-automation/index.ts` (line ~243)

**Details:**
Hardcoded UUID `5e2d8710-7a23-4c33-87a2-4ad9ced4e936` with `assignee_name: 'Evan'`.

- [ ] Look up team member by name dynamically instead of hardcoded UUID
- [ ] Add fallback handling if team member is not found

---

### Task 12: Remove Console Logs from Production Code

**Severity:** NORMAL - Code Quality
**Effort:** ~30 minutes

**Files:**
- Modify: `src/contexts/CallContext.tsx` (39 console.log statements)
- Modify: `src/contexts/AuthContext.tsx`

**Details:**
39 `console.log` statements in CallContext alone, all prefixed with `[CallContext]`.

- [ ] Remove or wrap debug logs in `import.meta.env.DEV` checks
- [ ] Keep `console.error` for genuine error conditions

---

### Task 13: Fix Sensitive Data in Logs

**Severity:** NORMAL - Data Privacy
**Effort:** ~5 minutes

**Files:**
- Modify: `supabase/functions/twilio-token/index.ts` (line ~133)

**Details:**
Only one line leaks PII: `console.log('[twilio-token] Authenticated user:', userId, 'email:', user.email);`

- [ ] Remove `user.email` from the log statement (keep userId only)

---

### Task 14: Fix Index-Based Keys in List Renders

**Severity:** NORMAL - React Best Practice
**Effort:** ~10 minutes

**Files:**
- Modify: `src/components/home/AudiencePathways.tsx` (6 occurrences)

**Details:**
6 occurrences of `key={index}` in `.map()` renders. Arrays are static string literals so practical risk is low, but it's a simple fix.

- [ ] Replace `key={index}` with stable unique identifiers (e.g., `key={goal}` or `key={item.title}`)

---

## Final Verification

- [ ] Run `npm run build` - must complete without errors
- [ ] Run `npm run lint` - must pass
- [ ] Manual test: Login as admin, verify all routes accessible
- [ ] Manual test: Login as client, verify cannot access admin routes
- [ ] Manual test: Verify OAuth callback flows (Gmail, Sheets, Dropbox, Calendar)
- [ ] Manual test: Verify Twilio calling still works
- [ ] Manual test: Verify edge functions respond correctly

## Update Documentation

- [ ] Update CLAUDE.md if internal patterns changed (CORS utility, error boundary)
- [ ] Move this plan to `docs/plans/completed/` when all tasks are done
