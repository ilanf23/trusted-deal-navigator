

## Plan: Fix File Upload Errors in Lead Files Section

### Root Cause Analysis

The database schema, storage bucket, and RLS policies are all correctly configured. The likely failure points are:

1. **`file_size` column is `integer` (32-bit)** — JS `File.size` returns bytes as a 64-bit number. Files larger than ~2GB would overflow, but even moderately large files could cause issues with certain Postgres drivers. Should be `bigint`.

2. **Error swallowing** — The current code logs errors to `console.error` but the toast messages are generic. If the storage upload succeeds but the DB insert fails (or vice versa), the user sees a vague error with no actionable info.

3. **Potential auth/RLS issue** — If the user's session expired or they don't have the `admin` role, both the storage upload and the `lead_files` insert would fail with RLS violations. The code doesn't distinguish auth errors from other failures.

### Changes

**1. Database migration: Change `file_size` from `integer` to `bigint`**
```sql
ALTER TABLE public.lead_files ALTER COLUMN file_size TYPE bigint;
```

**2. Improve error handling in `LeadFilesSection.tsx`**
- Add more descriptive error messages that surface the actual error text
- Add a check for auth session before attempting upload
- Ensure the toast shows the specific failure reason (e.g., "Permission denied" vs "Storage error")
- Add a try/catch around the individual file loop that doesn't silently continue on DB errors

**3. No new API or integration needed**
The existing Supabase Storage + `lead_files` table approach is correct. This is a bug fix, not an architecture problem.

### Files to Modify
- `supabase/migrations/` — new migration for `bigint` change
- `src/components/admin/LeadFilesSection.tsx` — better error handling and auth check

