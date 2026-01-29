-- Create call_events table to track full lifecycle and buffer calls
CREATE TABLE public.call_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_flow_id UUID NOT NULL DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'webhook_received', 'db_inserted', 'realtime_sent', 'frontend_received', 'answered', 'completed', 'missed'
  from_number TEXT,
  to_number TEXT,
  lead_id UUID REFERENCES public.leads(id),
  lead_name TEXT,
  webhook_received BOOLEAN DEFAULT FALSE,
  db_inserted BOOLEAN DEFAULT FALSE,
  realtime_sent BOOLEAN DEFAULT FALSE,
  frontend_received BOOLEAN DEFAULT FALSE,
  frontend_acknowledged_at TIMESTAMPTZ,
  device_ready BOOLEAN,
  socket_connected BOOLEAN,
  user_session_active BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookup by call_sid
CREATE INDEX idx_call_events_call_sid ON public.call_events(call_sid);
CREATE INDEX idx_call_events_flow_id ON public.call_events(call_flow_id);
CREATE INDEX idx_call_events_created ON public.call_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all call events
CREATE POLICY "Admins can read call events"
ON public.call_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow service role to insert (from edge functions)
CREATE POLICY "Service can insert call events"
ON public.call_events
FOR INSERT
WITH CHECK (true);

-- Allow service role to update
CREATE POLICY "Service can update call events"
ON public.call_events
FOR UPDATE
USING (true);

-- Add call_flow_id to active_calls for tracing
ALTER TABLE public.active_calls ADD COLUMN IF NOT EXISTS call_flow_id UUID;
ALTER TABLE public.active_calls ADD COLUMN IF NOT EXISTS webhook_timestamp TIMESTAMPTZ;
ALTER TABLE public.active_calls ADD COLUMN IF NOT EXISTS frontend_ack_at TIMESTAMPTZ;

-- Enable realtime for call_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_events;