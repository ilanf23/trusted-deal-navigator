-- Create lead_files table for file attachments on leads
CREATE TABLE public.lead_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_files ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins
CREATE POLICY "Admins can manage lead files"
  ON public.lead_files
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for lead files
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-files', 'lead-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload lead files
CREATE POLICY "Authenticated users can upload lead files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lead-files');

-- Allow authenticated users to read lead files
CREATE POLICY "Authenticated users can read lead files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lead-files');

-- Allow authenticated users to delete lead files
CREATE POLICY "Authenticated users can delete lead files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lead-files');
