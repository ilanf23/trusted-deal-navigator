-- Add Google Calendar columns to evan_appointments for sync tracking
ALTER TABLE public.evan_appointments 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_evan_appointments_google_event_id ON public.evan_appointments(google_event_id);

-- Create calendar_connections table for storing Google Calendar OAuth tokens
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email VARCHAR NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own calendar connection
CREATE POLICY "Users can view their own calendar connection"
ON public.calendar_connections
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own calendar connection
CREATE POLICY "Users can insert their own calendar connection"
ON public.calendar_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own calendar connection
CREATE POLICY "Users can update their own calendar connection"
ON public.calendar_connections
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own calendar connection
CREATE POLICY "Users can delete their own calendar connection"
ON public.calendar_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_calendar_connections_updated_at
BEFORE UPDATE ON public.calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();