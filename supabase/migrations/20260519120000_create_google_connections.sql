-- Unified Google OAuth connections table.
-- Replaces calendar_connections, gmail_connections, sheets_connections.
-- Old tables will be dropped in a later migration.

CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email CHARACTER VARYING NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT,
  calendar_id TEXT,
  drive_watch_channel_id TEXT,
  drive_watch_channel_token TEXT,
  drive_watch_resource_id TEXT,
  drive_watch_expiry TIMESTAMP WITH TIME ZONE,
  drive_watch_spreadsheet_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_connections_drive_watch_channel_id
  ON public.google_connections (drive_watch_channel_id)
  WHERE drive_watch_channel_id IS NOT NULL;

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own google_connection"
  ON public.google_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to google_connections"
  ON public.google_connections
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Backfill from the three legacy tables.
-- For each user_id we take:
--   access_token, refresh_token, token_expiry, email  -> from the row with the latest updated_at across all 3 tables
--   calendar_id                                       -> from calendar_connections (latest row per user)
--   drive_watch_*                                     -> from sheets_connections   (latest row per user)
--   created_at                                        -> MIN across all 3 tables
--   updated_at                                        -> MAX across all 3 tables
--   scopes                                            -> full combined scope string

WITH unioned AS (
  SELECT user_id, email, access_token, refresh_token, token_expiry, created_at, updated_at
    FROM public.calendar_connections
  UNION ALL
  SELECT user_id, email, access_token, refresh_token, token_expiry, created_at, updated_at
    FROM public.gmail_connections
  UNION ALL
  SELECT user_id, email, access_token, refresh_token, token_expiry, created_at, updated_at
    FROM public.sheets_connections
),
latest_token AS (
  SELECT DISTINCT ON (user_id)
         user_id, email, access_token, refresh_token, token_expiry
    FROM unioned
   ORDER BY user_id, updated_at DESC
),
ts AS (
  SELECT user_id,
         MIN(created_at) AS earliest_created,
         MAX(updated_at) AS latest_updated
    FROM unioned
   GROUP BY user_id
),
cal AS (
  SELECT DISTINCT ON (user_id)
         user_id, calendar_id
    FROM public.calendar_connections
   ORDER BY user_id, updated_at DESC
),
sh AS (
  SELECT DISTINCT ON (user_id)
         user_id,
         drive_watch_channel_id,
         drive_watch_channel_token,
         drive_watch_resource_id,
         drive_watch_expiry,
         drive_watch_spreadsheet_id
    FROM public.sheets_connections
   ORDER BY user_id, updated_at DESC
)
INSERT INTO public.google_connections (
  user_id,
  email,
  access_token,
  refresh_token,
  token_expiry,
  scopes,
  calendar_id,
  drive_watch_channel_id,
  drive_watch_channel_token,
  drive_watch_resource_id,
  drive_watch_expiry,
  drive_watch_spreadsheet_id,
  created_at,
  updated_at
)
SELECT
  l.user_id,
  l.email,
  l.access_token,
  l.refresh_token,
  l.token_expiry,
  'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email profile',
  c.calendar_id,
  s.drive_watch_channel_id,
  s.drive_watch_channel_token,
  s.drive_watch_resource_id,
  s.drive_watch_expiry,
  s.drive_watch_spreadsheet_id,
  t.earliest_created,
  t.latest_updated
FROM latest_token l
JOIN ts t USING (user_id)
LEFT JOIN cal c USING (user_id)
LEFT JOIN sh s USING (user_id)
ON CONFLICT (user_id) DO NOTHING;
