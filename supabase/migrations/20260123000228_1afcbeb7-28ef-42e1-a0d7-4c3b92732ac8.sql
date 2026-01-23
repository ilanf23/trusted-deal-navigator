-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload attachments
CREATE POLICY "Users can upload email attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read their own attachments
CREATE POLICY "Users can read their own email attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete their own email attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);