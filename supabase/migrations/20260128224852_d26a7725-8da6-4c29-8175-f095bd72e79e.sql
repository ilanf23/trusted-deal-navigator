-- Add field to track when initial nudge was created (one-time only)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS initial_nudge_created_at TIMESTAMP WITH TIME ZONE;