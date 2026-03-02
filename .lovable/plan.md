

## Plan: Fix 400 Error on File Upload in Underwriting Related Tab

### Investigation Summary
Everything on the backend appears correctly configured:
- The `lead-files` storage bucket exists and is private
- All four storage policies (INSERT, SELECT, UPDATE, DELETE) are present and PERMISSIVE for admin role
- The logged-in user has the `admin` role confirmed via `has_role()` function
- The `lead_files` table schema is correct

### Root Cause (Most Likely)
The 400 error from Supabase storage upload is likely caused by one of:
1. **Missing `upsert` option** -- if a file with the same path somehow exists (e.g., from a previous partial upload), the upload silently fails with 400 instead of overwriting
2. **Content-type detection issues** -- the `contentType: file.type` option may send an empty or invalid MIME type for certain files
3. **No error logging** -- the current code catches `uploadError` but only shows a generic toast, hiding the actual error message

### Changes

**1. Fix `UnderwritingExpandedView.tsx` upload handler (lines 546-554)**

Add three fixes:
- Add `upsert: true` to the storage upload options to prevent 400 on path conflicts
- Fallback `contentType` to `application/octet-stream` if `file.type` is empty
- Log the actual error object via `console.error` so we can diagnose if the issue persists

```ts
// Before:
const { error: uploadError } = await supabase.storage
  .from('lead-files')
  .upload(filePath, file, { contentType: file.type });

if (uploadError) {
  setUploadingFile(false);
  toast.error('Failed to upload file');
  return;
}

// After:
const { error: uploadError } = await supabase.storage
  .from('lead-files')
  .upload(filePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });

if (uploadError) {
  console.error('Storage upload error:', uploadError);
  setUploadingFile(false);
  toast.error('Failed to upload file');
  return;
}
```

**2. Apply same fix to `LeadFilesSection.tsx` upload handler (lines 90-95)**

Same three improvements: `upsert: true`, content-type fallback, and error logging. This component is used in the `LeadDetailDialog` and could have the same problem.

### Why This Should Work
- `upsert: true` is the most common fix for Supabase storage 400 errors -- it tells the server to overwrite if a path conflict exists rather than failing
- The content-type fallback prevents sending an empty MIME type which some Supabase versions reject
- Console logging will give us exact error details if the issue persists after these fixes

