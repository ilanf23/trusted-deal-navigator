-- Create table for active/incoming calls
CREATE TABLE public.active_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT NOT NULL UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing',
  direction TEXT NOT NULL DEFAULT 'inbound',
  lead_id UUID REFERENCES public.leads(id),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;

-- Policy for admins to view all calls
CREATE POLICY "Admins can view all active calls"
ON public.active_calls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy for admins to update calls
CREATE POLICY "Admins can update active calls"
ON public.active_calls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_calls;

-- Create trigger for updated_at
CREATE TRIGGER update_active_calls_updated_at
BEFORE UPDATE ON public.active_calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();