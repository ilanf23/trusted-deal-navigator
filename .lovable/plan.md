

## Plan: Fix File Upload in Underwriting Deal Cards

### Root Cause
Two issues are preventing file uploads:

1. **Missing UPDATE storage policy**: The `storage.objects` table has INSERT, SELECT, DELETE policies for `lead-files` but no UPDATE policy. Some Supabase storage upload flows require UPDATE permissions.

2. **Wrong `file_url` stored in expanded view**: `UnderwritingExpandedView.tsx` stores the full public URL instead of the storage path. Since the bucket is private, this breaks downloads/previews. The `LeadFilesSection.tsx` already does it correctly.

### Changes

**1. Database migration -- add missing UPDATE policy and recreate policies as explicitly PERMISSIVE**

Drop and recreate all four `lead-files` storage policies to ensure they are PERMISSIVE (the default, but safeguarding), and add the missing UPDATE policy:

```sql
-- Drop existing
DROP POLICY IF EXISTS "Admins can upload lead files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read lead files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete lead files" ON storage.objects;

-- Recreate as PERMISSIVE with UPDATE added
CREATE POLICY "Admins can upload lead files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-files' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can read lead files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead-files' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update lead files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'lead-files' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete lead files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lead-files' AND public.has_role(auth.uid(), 'admin'::public.app_role));
```

**2. Fix `UnderwritingExpandedView.tsx` -- store path, not public URL**

In `handleFileUpload` (around line 557-558), change:
```ts
// Before (broken):
const { data: urlData } = supabase.storage.from('lead-files').getPublicUrl(filePath);
const fileUrl = urlData?.publicUrl || filePath;

// After (correct -- store just the path for signed URL access):
const fileUrl = filePath;
```

Remove the unused `getPublicUrl` call. The download handler (`handleDeleteFile`) also needs fixing -- it currently tries to parse a public URL to extract the path (line 580-581). Since we'll now store the path directly, simplify to use `file.file_url` as the storage path.

Also fix the download link in the template (line 1525-1529) to use signed URLs instead of the raw `file_url` which won't work for a private bucket.

