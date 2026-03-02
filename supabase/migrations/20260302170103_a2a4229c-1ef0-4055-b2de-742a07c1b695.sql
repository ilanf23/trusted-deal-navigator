-- Drop existing storage policies for lead-files
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