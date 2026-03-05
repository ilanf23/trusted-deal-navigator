-- Shared Dropbox connection (single row for the whole company)
CREATE TABLE IF NOT EXISTS public.dropbox_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_by TEXT,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  account_id TEXT,
  cursor TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dropbox_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view dropbox connection"
  ON public.dropbox_connections FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- File metadata + text index
CREATE TABLE IF NOT EXISTS public.dropbox_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dropbox_id TEXT NOT NULL UNIQUE,
  dropbox_path TEXT NOT NULL,
  dropbox_path_display TEXT NOT NULL,
  dropbox_rev TEXT,
  name TEXT NOT NULL,
  is_folder BOOLEAN NOT NULL DEFAULT false,
  size BIGINT,
  mime_type TEXT,
  modified_at TIMESTAMPTZ,
  content_hash TEXT,
  extracted_text TEXT,
  extraction_status TEXT DEFAULT 'pending',
  extraction_error TEXT,
  extracted_at TIMESTAMPTZ,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dropbox_files_path ON public.dropbox_files(dropbox_path);
CREATE INDEX IF NOT EXISTS idx_dropbox_files_lead ON public.dropbox_files(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dropbox_files_fts ON public.dropbox_files
  USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(extracted_text,'')));
CREATE INDEX IF NOT EXISTS idx_dropbox_files_extraction ON public.dropbox_files(extraction_status)
  WHERE extraction_status = 'pending';

ALTER TABLE public.dropbox_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view dropbox files"
  ON public.dropbox_files FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage dropbox files"
  ON public.dropbox_files FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));