
-- Create lead_files table
CREATE TABLE public.lead_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_files ENABLE ROW LEVEL SECURITY;

-- Admin access policy
CREATE POLICY "Admins can manage lead files"
  ON public.lead_files
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage RLS: allow authenticated users to upload to lead-files bucket
CREATE POLICY "Admins can upload lead files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lead-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read lead files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'lead-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete lead files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'lead-files' AND has_role(auth.uid(), 'admin'::app_role));
