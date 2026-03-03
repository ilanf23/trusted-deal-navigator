

## Plan: Fix File Upload Across All Expanded Views

### Root Cause Analysis — 3 Distinct Bugs Found

I traced the "Failed to upload file" error across all three expanded views and found **three separate root causes**:

| View | Root Cause | Severity |
|------|-----------|----------|
| **PeopleExpandedView** | Uploads to storage bucket `people-files` which **does not exist** | Upload always fails |
| **PipelineExpandedView** | Stores public URLs (via `getPublicUrl`) on a **private** bucket — URL is unusable. Also missing `upsert: true` and `contentType` fallback | Upload may succeed but download/preview breaks |
| **UnderwritingExpandedView** | Better error handling already applied, but still shows generic "Failed to upload file" toast without reason | Partial fix from last iteration |

Additionally: `people_files.file_size` column is `integer` (should be `bigint`), and **none** of the three handlers validate auth session before uploading.

### Changes

**1. Database Migration**
- Create `people-files` storage bucket (private, matching `lead-files` pattern)
- Add admin-only RLS policies on `storage.objects` for `people-files` bucket (INSERT, SELECT, UPDATE, DELETE)
- Alter `people_files.file_size` from `integer` to `bigint`

**2. Fix PipelineExpandedView.tsx upload handler**
- Add auth session check before upload
- Add `upsert: true` and `contentType` fallback (`application/octet-stream`)
- Store **relative file path** (not public URL) in `file_url` column
- Fix delete handler to use `file_url` directly (no URL parsing needed)
- Fix download to use `createSignedUrl` instead of raw `<a href>`
- Add diagnostic `console.error` logging with actual error messages
- Surface specific error reasons in toast

**3. Fix PeopleExpandedView.tsx upload handler**
- Same auth session check pattern
- Add `upsert: true` and `contentType` fallback
- Store relative path instead of public URL
- Fix delete handler (same as Pipeline)
- Fix download links to use signed URLs
- Add diagnostics logging

**4. Fix UnderwritingExpandedView.tsx upload handler**
- Add auth session check (currently missing)
- Surface actual `uploadError.message` in toast instead of generic text
- Add diagnostics logging

**5. Fix download links in all three expanded view templates**
- Pipeline and People views currently render `<a href={f.file_url}>` which points to a public URL of a private bucket (broken)
- Replace with `onClick` handler that generates a signed URL, matching the pattern already working in UnderwritingExpandedView

### Files to Modify
- `supabase/migrations/` — new migration (bucket + RLS + bigint)
- `src/components/admin/PipelineExpandedView.tsx` — upload, delete, download handlers
- `src/components/admin/PeopleExpandedView.tsx` — upload, delete, download handlers
- `src/components/admin/UnderwritingExpandedView.tsx` — auth check + error surface

### No New APIs or Integrations Needed
The existing Supabase Storage architecture is correct. These are all implementation bugs in the upload/download handlers.

