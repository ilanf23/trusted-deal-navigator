# Codebase Audit - Master Remediation Plan

## Overview
Comprehensive codebase audit covering security vulnerabilities, error handling gaps, architecture issues, auth/routing gaps, edge function problems, and performance/UX concerns. Issues are categorized as Critical, Important, or Normal and organized into actionable remediation tasks.

## Context
- Files involved: All edge functions in `supabase/functions/`, auth/routing in `src/App.tsx` + `src/contexts/AuthContext.tsx`, large admin components in `src/components/admin/`, hooks in `src/hooks/`
- Related patterns: Supabase RLS, ProtectedRoute/AdminRoute/EmployeeRoute guards, TanStack Query, shadcn/ui
- Dependencies: Supabase, Twilio, OpenAI, Dropbox, Gmail, Google Sheets APIs

## Development Approach
- Fix critical security issues first, then stability, then architecture
- Each task should be tested manually after completion
- Edge function changes require deployment to staging before production
- **No automated test suite exists** - manual verification required

---

## CRITICAL ISSUES

### Task 1: Fix Wildcard CORS on All Edge Functions

**Severity:** CRITICAL - Security
**Risk:** Any website can make authenticated API calls to your edge functions (CSRF-like attacks)

**Files:**
- Modify: `supabase/functions/_shared/cors.ts` (or create shared CORS config)
- Modify: All `supabase/functions/*/index.ts` files

**Details:**
Every edge function returns `'Access-Control-Allow-Origin': '*'`. This allows requests from any origin, enabling cross-site request forgery.

- [ ] Create a shared CORS utility that validates origin against an allowlist (production domain + localhost for dev)
- [ ] Replace `'Access-Control-Allow-Origin': '*'` in all edge functions with the validated origin
- [ ] Test preflight (OPTIONS) requests still work correctly
- [ ] Verify all OAuth callback flows still function

---

### Task 2: Wrap Unprotected OAuth Callback Routes with AdminRoute

**Severity:** CRITICAL - Auth Bypass
**Risk:** Non-admin authenticated users can access admin callback pages and process OAuth exchanges

**Files:**
- Modify: `src/App.tsx` (lines 205, 211-213)

**Details:**
Four `/admin` callback routes are NOT wrapped in `<AdminRoute>`:
- `/admin/sheets-callback`
- `/admin/dropbox/callback`
- `/admin/inbox/callback`
- `/admin/calendar-callback`

Meanwhile `/superadmin` callbacks ARE properly protected by `AdminRouteLayout`.

- [ ] Wrap all four callback routes with `<AdminRoute>` component
- [ ] Verify OAuth flows still complete correctly after adding the wrapper
- [ ] Verify non-admin users are redirected to /auth

---

### Task 3: Fix SQL Pattern Injection in twilio-transcription

**Severity:** CRITICAL - SQL Injection
**Risk:** Phone number containing SQL wildcards/patterns can manipulate database queries

**Files:**
- Modify: `supabase/functions/twilio-transcription/index.ts` (line 90)

**Details:**
```typescript
.or(`phone_number.ilike.%${normalizedPhone}%`)
```
The `normalizedPhone` value from Twilio is used directly in an `ilike` pattern without escaping special characters (`%`, `_`, `\`).

- [ ] Escape SQL pattern characters in `normalizedPhone` before using in ilike
- [ ] Consider using `.eq()` with exact match instead of pattern matching where possible
- [ ] Test with phone numbers containing special characters

---

### Task 4: Fix Dynamic Table Name Injection in ai-agent-executor

**Severity:** CRITICAL - SQL Injection
**Risk:** Attacker-controlled table names in undo/redo operations can target arbitrary tables

**Files:**
- Modify: `supabase/functions/ai-agent-executor/index.ts` (lines 318-336, 360-386)

**Details:**
`undoChange` and `redoChange` use `target_table` from the database record directly in Supabase `.from(target_table)` calls without validating against an allowlist.

- [ ] Create an allowlist of valid table names for undo/redo operations
- [ ] Validate `target_table` against the allowlist before executing any DB operation
- [ ] Return an error if table name is not in the allowlist

---

### Task 5: Add Authorization Checks to ai-agent-executor Undo/Redo

**Severity:** CRITICAL - Privilege Escalation
**Risk:** Any admin can undo/redo changes made by other users

**Files:**
- Modify: `supabase/functions/ai-agent-executor/index.ts` (lines 322-387)

**Details:**
- `undoChange()` passes `userId` but never verifies the change belongs to that user
- `redoChange()` doesn't even accept a `userId` parameter

- [ ] Add ownership check in `undoChange`: verify `change.user_id === userId` or `change.team_member_id` matches
- [ ] Add `userId` parameter to `redoChange` and verify ownership
- [ ] Return 403 error if user doesn't own the change

---

### Task 6: Add Error Boundary Around CallProvider

**Severity:** CRITICAL - Stability
**Risk:** A single Twilio SDK error crashes the entire application

**Files:**
- Modify: `src/App.tsx` (around CallProvider wrapping)
- Create: `src/components/CallErrorBoundary.tsx`

**Details:**
`CallProvider` wraps the entire app at the top level with no error boundary. Any unhandled error in the Twilio SDK causes a white screen for all users.

- [ ] Create a CallErrorBoundary component that catches errors and shows a fallback UI
- [ ] Wrap `CallProvider` in `App.tsx` with the error boundary
- [ ] Add recovery mechanism (retry button to reinitialize Twilio)

---

### Task 7: Fix Unhandled Promise Rejections in AuthContext

**Severity:** CRITICAL - Stability
**Risk:** Silent auth state corruption, session recovery failures

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (lines 105-110, 126, 135, 147-156)

**Details:**
Multiple `.then()` calls without `.catch()` handlers:
- `supabase.auth.getSession().then(...)` at line 126
- `handleVisibilityChange` async calls without catch blocks
- Session recovery in `.then()` chains that silently fail

- [ ] Add `.catch()` handlers to all `.then()` chains in auth state management
- [ ] Add error logging for failed session recovery
- [ ] Ensure auth loading state is properly set to false even on errors

---

### Task 8: Fix Open Redirect Vulnerabilities

**Severity:** CRITICAL - Security
**Risk:** Attackers can redirect users to phishing sites after OAuth flow

**Files:**
- Modify: `src/hooks/useGmailConnection.ts` (line 213)
- Modify: `src/hooks/useGmail.ts` (line 87)
- Modify: `src/pages/admin/InboxCallback.tsx` (lines 62, 70)

**Details:**
- `window.location.href = data.url` used without validating the URL is from a trusted domain
- `returnPath` from localStorage used in `navigate()` without validation
- An attacker could set localStorage values and redirect to external URLs

- [ ] Validate OAuth redirect URLs against allowlisted domains (accounts.google.com, etc.)
- [ ] Validate `returnPath` starts with `/` and doesn't contain `//` (prevents protocol-relative redirects)
- [ ] Add URL validation utility function for reuse

---

## IMPORTANT ISSUES

### Task 9: Fix Missing Authorization in google-sheets-api

**Severity:** IMPORTANT - Privilege Escalation
**Risk:** Any admin can access another team member's spreadsheet connections

**Files:**
- Modify: `supabase/functions/google-sheets-api/index.ts` (lines 103-113)

**Details:**
When `teamMemberName` is provided, the function queries by name without checking if the requesting user has permission to access that team member's connection.

- [ ] Add authorization check: verify the requester is an owner or is requesting their own connection
- [ ] Return 403 for unauthorized cross-member access

---

### Task 10: Fix Missing Authorization in dropbox-api

**Severity:** IMPORTANT - Privilege Escalation
**Risk:** Admin users can link files to leads they don't own

**Files:**
- Modify: `supabase/functions/dropbox-api/index.ts` (lines 531-552, 554-613)

**Details:**
`handleLinkToLead` and `handleSearchContent` check admin role but don't verify the user owns or is assigned to the lead.

- [ ] Add lead ownership/assignment check before allowing file operations
- [ ] Return 403 for unauthorized lead access

---

### Task 11: Fix Dropbox OAuth State Parameter Vulnerability

**Severity:** IMPORTANT - Auth Bypass
**Risk:** Attacker with any valid UUID can store Dropbox tokens under another user's account

**Files:**
- Modify: `supabase/functions/dropbox-auth/index.ts` (lines 88-90, 101)

**Details:**
- `stateUserId` fallback accepts any valid UUID format without session validation
- OAuth state parameter is just the userId (predictable), not a cryptographic token

- [ ] Remove the stateUserId fallback - always require a valid session
- [ ] Generate cryptographic state tokens, store server-side, validate on callback
- [ ] Reject requests where state doesn't match stored token

---

### Task 12: Change Rate Limiting to Fail-Closed

**Severity:** IMPORTANT - Security
**Risk:** During DB outages, rate limiting is completely disabled

**Files:**
- Modify: `supabase/functions/_shared/rateLimit.ts` (line 52-54)

**Details:**
```typescript
if (error) {
  console.error('[RATE_LIMIT] DB error, allowing request:', error.message);
  return null; // fail-open on DB errors
}
```

- [ ] Change to fail-closed: return rate limit error when DB is unavailable
- [ ] Add a short in-memory fallback counter for graceful degradation
- [ ] Log rate limit DB failures as critical alerts

---

### Task 13: Remove or Implement super_admin Role

**Severity:** IMPORTANT - Dead Code / Auth Confusion
**Risk:** Code checking `super_admin` role always evaluates to false; authorization model is confusing

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (lines 54-55)
- Modify: `src/components/admin/AdminSidebar.tsx` (line 131)
- Potentially: Add migration to create the role, or remove all references

**Details:**
The `app_role` enum only has `admin`, `client`, `partner`. No `super_admin` value exists. Code like `if (roles.includes('super_admin')) return 'super_admin'` is dead code. Founders are identified by `is_owner` on `team_members`.

- [ ] Decision: Either add `super_admin` to the enum and assign it to founders, OR remove all `super_admin` references and use `is_owner` consistently
- [ ] Update AuthContext role resolution logic
- [ ] Update AdminSidebar role checks
- [ ] Verify no RLS policies depend on the `super_admin` role

---

### Task 14: Implement Route-Level Code Splitting

**Severity:** IMPORTANT - Performance
**Risk:** Entire app bundle loaded upfront; 97+ routes worth of code downloaded on first visit

**Files:**
- Modify: `src/App.tsx` (lines 19-98 static imports)

**Details:**
All page components are statically imported. No `React.lazy()` or `Suspense` used at route level.

- [ ] Convert static page imports to `React.lazy()` for all route-level components
- [ ] Add `<Suspense fallback={<Loading />}>` boundaries around route groups
- [ ] Consider grouping routes by portal (admin, superadmin, client, partner) for chunk optimization
- [ ] Verify all routes still render correctly after conversion

---

### Task 15: Fix Hardcoded Team Member UUID

**Severity:** IMPORTANT - Maintainability / Data Integrity
**Risk:** If Evan's team member record changes, automation silently breaks

**Files:**
- Modify: `supabase/functions/call-to-lead-automation/index.ts` (line 243)

**Details:**
```typescript
team_member_id: '5e2d8710-7a23-4c33-87a2-4ad9ced4e936',
```

- [ ] Look up team member by name or role dynamically instead of hardcoded UUID
- [ ] Add fallback handling if team member is not found
- [ ] Consider making the default assignee configurable via environment variable

---

### Task 16: Add Missing CSRF Protection

**Severity:** IMPORTANT - Security
**Risk:** Authenticated users visiting malicious sites can have actions performed on their behalf

**Files:**
- Modify: Edge functions that handle state-changing operations (POST/PUT/DELETE)

**Details:**
No CSRF token validation exists. Combined with wildcard CORS (Task 1), this creates significant CSRF risk. Fixing CORS (Task 1) largely mitigates this, but defense-in-depth is recommended.

- [ ] After fixing CORS (Task 1), evaluate remaining CSRF risk
- [ ] Consider adding CSRF token validation for high-risk operations (role changes, financial operations)
- [ ] Document the CSRF protection strategy

---

### Task 17: Reduce N+1 Query Patterns in Large Components

**Severity:** IMPORTANT - Performance
**Risk:** 14-20 separate API calls per component mount; excessive Supabase read costs

**Files:**
- Modify: `src/components/admin/PeopleExpandedView.tsx` (14 useQuery calls)
- Modify: `src/components/admin/LeadDetailDialog.tsx` (20 useQuery calls)
- Modify: `src/hooks/useFeedData.ts` (10 parallel queries with overlapping data)

**Details:**
Components fire many independent queries that could be combined. `useFeedData.ts` fetches leads and lead_activities twice in the same `Promise.all()`.

- [ ] Identify queries that fetch overlapping data and consolidate
- [ ] Use Supabase joins to combine related queries (e.g., person + emails + phones in one query)
- [ ] Remove duplicate queries in useFeedData.ts
- [ ] Consider using TanStack Query's `useQueries` for parallel fetching with deduplication

---

### Task 18: Protect PII in Email Notifications

**Severity:** IMPORTANT - Data Privacy
**Risk:** Call transcripts containing customer personal info sent in email notifications

**Files:**
- Modify: `supabase/functions/call-to-lead-automation/index.ts` (lines 363-368)

**Details:**
Email notifications include up to 500 characters of call transcript, which may contain customer PII, bank details, SSNs, etc.

- [ ] Remove or redact transcript content from email notifications
- [ ] Replace with a link to view the transcript in the admin portal
- [ ] Or add PII detection/redaction before including in emails

---

## NORMAL ISSUES

### Task 19: Consolidate Duplicate Utility Functions

**Severity:** NORMAL - Code Quality
**Risk:** Bug fixes in one copy don't propagate; DRY violation

**Files:**
- Create: `src/lib/formatting.ts`
- Modify: `src/components/admin/InlineEditableFields.tsx` (formatPhoneNumber at line 18)
- Modify: `src/components/admin/LeadDetailDialog.tsx` (formatPhoneNumber at lines 49-66)
- Modify: `src/components/admin/PeopleExpandedView.tsx` (formatFileSize, getFileIcon at lines 50-65)
- Modify: `src/components/admin/UnderwritingExpandedView.tsx` (formatDate, formatValue at lines 98-150)

**Details:**
`formatPhoneNumber()`, `formatFileSize()`, `formatDate()`, `formatValue()`, `getFileIcon()` are duplicated across 4+ files.

- [ ] Create shared `src/lib/formatting.ts` with all formatting utilities
- [ ] Replace all duplicates with imports from the shared module
- [ ] Verify all call sites work correctly

---

### Task 20: Consolidate Duplicate Type Definitions

**Severity:** NORMAL - Code Quality
**Risk:** Type drift between copies causes runtime errors

**Files:**
- Create: `src/types/leads.ts`
- Modify: `src/components/admin/UnderwritingExpandedView.tsx` (Lead, LeadEmail etc. at lines 56-94)
- Modify: `src/components/admin/UnderwritingDetailPanel.tsx` (lines 29-31)
- Modify: `src/components/admin/LeadDetailDialog.tsx` (lines 72-99)
- Modify: `src/pages/admin/People.tsx` (lines 82-100)

**Details:**
`Lead`, `LeadEmail`, `LeadPhone`, `LeadAddress` interfaces defined in 4+ files with slight variations.

- [ ] Extract canonical type definitions to `src/types/leads.ts`
- [ ] Import from shared types file in all consuming components
- [ ] Verify no type mismatches after consolidation

---

### Task 21: Add Search Input Debouncing

**Severity:** NORMAL - Performance
**Risk:** Filter recalculations and re-renders on every keystroke

**Files:**
- Modify: `src/pages/admin/People.tsx` (line 460)
- Modify: `src/pages/admin/Pipeline.tsx` (search inputs)
- Modify: Other admin pages with search fields

**Details:**
Search inputs directly call `setSearchTerm(e.target.value)` without debouncing.

- [ ] Add 300ms debounce to search input state updates
- [ ] Use either a custom hook or `useDeferredValue` from React 18
- [ ] Apply consistently across all admin search inputs

---

### Task 22: Remove Console Logs from Production Code

**Severity:** NORMAL - Code Quality
**Risk:** Performance overhead, information leakage in browser console

**Files:**
- Modify: `src/contexts/CallContext.tsx` (21+ console.log statements)
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/components/admin/LeadDetailDialog.tsx`

**Details:**
Debug console.log statements left in production code, especially in CallContext.

- [ ] Wrap debug logs in development-only checks or remove them
- [ ] Keep error-level logging (console.error) for genuine error conditions
- [ ] Consider using a logging utility that respects environment

---

### Task 23: Add Basic Accessibility Attributes

**Severity:** NORMAL - UX / Compliance
**Risk:** Screen readers and keyboard users cannot navigate the application

**Files:**
- Modify: Admin table components in `src/components/admin/`
- Modify: Dialog/modal components
- Modify: Icon-only buttons throughout the app

**Details:**
Zero `aria-label`, `role`, or `onKeyDown` handlers found. Icon-only buttons lack accessible labels.

- [ ] Add aria-labels to all icon-only buttons
- [ ] Add role attributes to interactive custom elements
- [ ] Add keyboard event handlers for custom interactive components
- [ ] Ensure dialogs trap focus properly

---

### Task 24: Fix Index-Based Keys in List Renders

**Severity:** NORMAL - React Performance
**Risk:** React can lose component state and reuse DOM nodes incorrectly

**Files:**
- Modify: `src/components/home/AudiencePathways.tsx` (lines 170, 205, 262, 319, 376, 433, 490)

**Details:**
7 occurrences of `key={index}` in list renders that should use stable identifiers.

- [ ] Replace `key={index}` with stable unique identifiers (e.g., item content hash or unique text)
- [ ] Verify no visual regressions after key changes

---

### Task 25: Lazy-Load Heavy Dependencies

**Severity:** NORMAL - Bundle Size
**Risk:** Rarely-used libraries included in main bundle

**Files:**
- Modify: Components importing `recharts`, `konva`, `react-konva`, `xlsx`, `@fortune-sheet/react`, `emoji-mart`

**Details:**
Heavy libraries loaded upfront even though they're only used in specific views.

- [ ] Use dynamic `import()` for recharts in chart components
- [ ] Use dynamic `import()` for konva/react-konva
- [ ] Use dynamic `import()` for xlsx in spreadsheet operations
- [ ] Evaluate removing styled-components (redundant with Tailwind)

---

### Task 26: Add Missing Loading Skeletons

**Severity:** NORMAL - UX
**Risk:** Users see blank areas while data loads

**Files:**
- Modify: Large admin views (Pipeline, People, Underwriting pages)
- Modify: Detail panels and expanded views

**Details:**
No skeleton loaders for tables, detail panels, or activity feeds during data fetching.

- [ ] Add skeleton components from shadcn/ui for table rows
- [ ] Add skeleton states for detail panel sections
- [ ] Add progressive loading for sub-sections in expanded views

---

### Task 27: Standardize Edge Function Error Responses

**Severity:** NORMAL - API Consistency
**Risk:** Client-side error handling breaks on inconsistent formats

**Files:**
- Modify: All edge functions in `supabase/functions/*/index.ts`

**Details:**
Some functions return `{ error: "..." }`, others `{ success: false, error: "..." }`, others plain text. No consistent format.

- [ ] Define standard error response shape: `{ success: false, error: string, code?: string }`
- [ ] Define standard success response shape: `{ success: true, data: any }`
- [ ] Apply consistently across all edge functions

---

### Task 28: Add Environment Variable Validation to Edge Functions

**Severity:** NORMAL - Reliability
**Risk:** Missing env vars cause cryptic deployment failures

**Files:**
- Modify: `supabase/functions/dropbox-api/index.ts` (lines 9-12)
- Modify: `supabase/functions/gmail-api/index.ts`
- Modify: `supabase/functions/call-to-lead-automation/index.ts`
- Modify: Other edge functions using `Deno.env.get()!`

**Details:**
Using `!` non-null assertion on `Deno.env.get()` at module level. If env vars are missing, functions fail with cryptic errors.

- [ ] Add startup validation that checks all required env vars
- [ ] Return clear error messages identifying which env var is missing
- [ ] Log validation results on function cold start

---

### Task 29: Sensitive Data in Logs

**Severity:** NORMAL - Data Privacy
**Risk:** User emails and identities exposed in production logs

**Files:**
- Modify: `supabase/functions/twilio-token/index.ts` (lines 133, 155, 165)

**Details:**
Logs include user email addresses and identities:
```
console.log('[twilio-token] Authenticated user:', userId, 'email:', user.email);
```

- [ ] Remove or hash PII from log statements
- [ ] Keep only user IDs (not emails) in production logs
- [ ] Review other edge functions for similar PII logging

---

### Task 30: Verify - Final Acceptance Checks

- [ ] Run `npm run build` - must complete without errors
- [ ] Run `npm run lint` - must pass
- [ ] Manual test: Login as admin, verify all routes accessible
- [ ] Manual test: Login as client, verify cannot access admin routes
- [ ] Manual test: Verify OAuth callback flows (Gmail, Sheets, Dropbox, Calendar)
- [ ] Manual test: Verify Twilio calling still works
- [ ] Manual test: Verify all edge functions respond correctly

### Task 31: Update Documentation

- [ ] Update CLAUDE.md if internal patterns changed (CORS utility, shared types, formatting lib)
- [ ] Move this plan to `docs/plans/completed/` when all tasks are done
