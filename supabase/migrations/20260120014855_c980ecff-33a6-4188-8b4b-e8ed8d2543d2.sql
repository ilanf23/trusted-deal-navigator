-- Create a table to store call rating notifications
CREATE TABLE public.call_rating_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  communication_id UUID REFERENCES public.evan_communications(id) ON DELETE SET NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT,
  lead_email TEXT,
  call_date TEXT NOT NULL,
  call_direction TEXT NOT NULL DEFAULT 'inbound',
  call_rating INTEGER NOT NULL CHECK (call_rating >= 1 AND call_rating <= 10),
  rating_reasoning TEXT,
  transcript_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.call_rating_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can manage call rating notifications
CREATE POLICY "Admins can manage call rating notifications"
  ON public.call_rating_notifications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster queries
CREATE INDEX idx_call_rating_notifications_created_at ON public.call_rating_notifications(created_at DESC);