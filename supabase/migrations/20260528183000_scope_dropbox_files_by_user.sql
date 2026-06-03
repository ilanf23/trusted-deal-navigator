-- Scope Dropbox metadata cache rows to the Supabase auth user whose Dropbox
-- account produced them. Existing rows are only cache data, not canonical CRM
-- attachments, so ambiguous unscoped rows are removed.

ALTER TABLE public.dropbox_files
  ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dropbox_files_user_id_fkey'
      AND conrelid = 'public.dropbox_files'::regclass
  ) THEN
    ALTER TABLE public.dropbox_files
      ADD CONSTRAINT dropbox_files_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

WITH connection_owner AS (
  SELECT count(*) AS connection_count, min(user_id) AS only_user_id
  FROM public.dropbox_connections
)
UPDATE public.dropbox_files AS f
SET user_id = c.only_user_id
FROM connection_owner AS c
WHERE f.user_id IS NULL
  AND c.connection_count = 1
  AND c.only_user_id IS NOT NULL;

DELETE FROM public.dropbox_files
WHERE user_id IS NULL;

ALTER TABLE public.dropbox_files
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.dropbox_files
  VALIDATE CONSTRAINT dropbox_files_user_id_fkey;

ALTER TABLE public.dropbox_files
  DROP CONSTRAINT IF EXISTS dropbox_files_dropbox_id_key;

DROP INDEX IF EXISTS public.idx_dropbox_files_path;
DROP INDEX IF EXISTS public.idx_dropbox_files_lead;
DROP INDEX IF EXISTS public.idx_dropbox_files_extraction;

CREATE UNIQUE INDEX IF NOT EXISTS dropbox_files_user_dropbox_id_key
  ON public.dropbox_files (user_id, dropbox_id);

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_id
  ON public.dropbox_files (user_id);

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_path
  ON public.dropbox_files (user_id, dropbox_path);

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_lead
  ON public.dropbox_files (user_id, lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_extraction
  ON public.dropbox_files (user_id, extraction_status)
  WHERE extraction_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dropbox_files_fts
  ON public.dropbox_files
  USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(extracted_text,'')));

DROP POLICY IF EXISTS "Authenticated users can view own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Authenticated users can insert own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Authenticated users can update own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Authenticated users can delete own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Admins can view dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Admins can manage dropbox files" ON public.dropbox_files;

CREATE POLICY "Authenticated users can view own dropbox files"
  ON public.dropbox_files
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can insert own dropbox files"
  ON public.dropbox_files
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can update own dropbox files"
  ON public.dropbox_files
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can delete own dropbox files"
  ON public.dropbox_files
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can view dropbox files"
  ON public.dropbox_files
  FOR SELECT
  TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can manage dropbox files"
  ON public.dropbox_files
  FOR ALL
  TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'super_admin'::app_role)
  );
