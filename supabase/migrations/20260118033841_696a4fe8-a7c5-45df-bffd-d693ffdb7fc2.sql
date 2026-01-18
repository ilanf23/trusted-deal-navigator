-- Add transcript and recording_url columns to evan_communications
ALTER TABLE public.evan_communications
ADD COLUMN IF NOT EXISTS transcript text,
ADD COLUMN IF NOT EXISTS recording_url text,
ADD COLUMN IF NOT EXISTS recording_sid text,
ADD COLUMN IF NOT EXISTS call_sid text;