
-- Create people-files storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('people-files', 'people-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for people-files bucket
CREATE POLICY "Admins can upload people files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'people-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view people files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'people-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update people files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'people-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete people files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'people-files' AND public.has_role(auth.uid(), 'admin'));

-- Fix people_files.file_size to bigint
ALTER TABLE public.people_files ALTER COLUMN file_size TYPE bigint;
