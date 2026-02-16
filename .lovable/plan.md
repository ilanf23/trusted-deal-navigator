

## Fix: Remove Hardcoded Email Addresses from Code

### Problem

The email `ilan@maverich.ai` (and other team emails) are hardcoded in multiple files across the codebase. This makes maintenance difficult and exposes personal information directly in source code.

### Affected Files and Occurrences

| File | Hardcoded Values |
|---|---|
| `supabase/functions/send-prequalification-email/index.ts` | `ilan@maverich.ai` (from + bcc) |
| `supabase/functions/send-newsletter/index.ts` | `ilan@maverich.ai` (reply_to), `newsletter@maverich.ai` (from), `unsubscribe@maverich.ai` (header) |
| `supabase/functions/call-to-lead-automation/index.ts` | `ilan@maverich.ai`, `adam@company.com` (recipients) |
| `src/pages/admin/IlanTeamEvanBugs.tsx` | `evan@test.com` (query filter) |
| `src/pages/admin/BugReporting.tsx` | Display text "Ilan @maverick.AI" (cosmetic, not functional) |

### Solution

#### 1. Edge Functions: Use Secrets

For the three edge functions, the emails should be stored as backend secrets and read via `Deno.env.get()`:

- **`ILAN_EMAIL`** = `ilan@maverich.ai` -- used across all three edge functions
- **`ADAM_EMAIL`** = `adam@company.com` -- used in call-to-lead-automation
- **`NEWSLETTER_FROM_EMAIL`** = `newsletter@maverich.ai` -- used in send-newsletter

Each edge function will read the secret at runtime:
```typescript
const ILAN_EMAIL = Deno.env.get("ILAN_EMAIL") || "ilan@maverich.ai";
```

#### 2. Frontend: Create a Constants File

Create `src/lib/constants.ts` with team email constants for use in frontend components:

```typescript
export const TEAM_EMAILS = {
  EVAN: "evan@test.com",
} as const;
```

Then update `IlanTeamEvanBugs.tsx` to import from constants instead of hardcoding.

#### 3. BugReporting.tsx -- No Change

The references to "Ilan @maverick.AI" in `BugReporting.tsx` are display labels (not email addresses), so they don't need to be extracted.

### Technical Steps

1. Add three new secrets: `ILAN_EMAIL`, `ADAM_EMAIL`, `NEWSLETTER_FROM_EMAIL`
2. Update `supabase/functions/send-prequalification-email/index.ts` to use `Deno.env.get("ILAN_EMAIL")`
3. Update `supabase/functions/send-newsletter/index.ts` to use `Deno.env.get("ILAN_EMAIL")` and `Deno.env.get("NEWSLETTER_FROM_EMAIL")`
4. Update `supabase/functions/call-to-lead-automation/index.ts` to use `Deno.env.get("ILAN_EMAIL")` and `Deno.env.get("ADAM_EMAIL")`
5. Create `src/lib/constants.ts` with `TEAM_EMAILS`
6. Update `src/pages/admin/IlanTeamEvanBugs.tsx` to import from constants
7. Redeploy affected edge functions

### Files Modified

- `supabase/functions/send-prequalification-email/index.ts`
- `supabase/functions/send-newsletter/index.ts`
- `supabase/functions/call-to-lead-automation/index.ts`
- `src/pages/admin/IlanTeamEvanBugs.tsx`
- `src/lib/constants.ts` (new)

