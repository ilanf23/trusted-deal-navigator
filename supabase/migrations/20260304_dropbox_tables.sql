-- Dropbox integration tables

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

-- Enable RLS
ALTER TABLE public.dropbox_connections ENABLE ROW LEVEL SECURITY;

-- Admins can read the shared connection
CREATE POLICY "Admins can view dropbox connection"
  ON public.dropbox_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

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
  extraction_status TEXT DEFAULT 'pending'
    CHECK (extraction_status IN ('pending','processing','completed','failed','skipped')),
  extraction_error TEXT,
  extracted_at TIMESTAMPTZ,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dropbox_files_path ON public.dropbox_files(dropbox_path);
CREATE INDEX IF NOT EXISTS idx_dropbox_files_lead ON public.dropbox_files(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dropbox_files_fts ON public.dropbox_files
  USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(extracted_text,'')));
CREATE INDEX IF NOT EXISTS idx_dropbox_files_extraction ON public.dropbox_files(extraction_status)
  WHERE extraction_status = 'pending';

-- Enable RLS
ALTER TABLE public.dropbox_files ENABLE ROW LEVEL SECURITY;

-- Admins can view all files
CREATE POLICY "Admins can view dropbox files"
  ON public.dropbox_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can insert/update/delete files
CREATE POLICY "Admins can manage dropbox files"
  ON public.dropbox_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
