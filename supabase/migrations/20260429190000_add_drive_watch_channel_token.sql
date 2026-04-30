-- Per-channel secret echoed back by Google Drive in x-goog-channel-token on every
-- watch notification. sheets-watch-webhook compares this against the stored value
-- (constant-time) before inserting into sheets_change_events.

ALTER TABLE public.sheets_connections
  ADD COLUMN IF NOT EXISTS drive_watch_channel_token TEXT;
