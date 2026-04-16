-- Google Drive Push Notifications support for 2-way Sheets sync.
-- Watches are per-user, per-spreadsheet, per-session (not persistent).

ALTER TABLE public.sheets_connections
  ADD COLUMN IF NOT EXISTS drive_watch_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_watch_resource_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_watch_expiry TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS drive_watch_spreadsheet_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sheets_connections_drive_watch_channel_id
  ON public.sheets_connections (drive_watch_channel_id)
  WHERE drive_watch_channel_id IS NOT NULL;

-- Append-only event log. Webhook inserts; SheetEditor subscribes via realtime.
CREATE TABLE IF NOT EXISTS public.sheets_change_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  resource_state TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sheets_change_events_spreadsheet_id_created_at
  ON public.sheets_change_events (spreadsheet_id, created_at DESC);

ALTER TABLE public.sheets_change_events ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read events; filtering is by spreadsheet_id in the client.
CREATE POLICY "Authenticated users can read sheets_change_events"
  ON public.sheets_change_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role (used by the webhook edge function) inserts; no direct writes from clients.
CREATE POLICY "Service role inserts sheets_change_events"
  ON public.sheets_change_events
  FOR INSERT
  WITH CHECK (false);

-- Publish to Supabase Realtime so SheetEditor can subscribe to postgres_changes.
ALTER PUBLICATION supabase_realtime ADD TABLE public.sheets_change_events;
