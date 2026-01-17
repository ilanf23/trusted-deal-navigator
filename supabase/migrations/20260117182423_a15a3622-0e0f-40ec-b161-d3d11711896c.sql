-- Create tasks table for Evan's to-do list
CREATE TABLE public.evan_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments/calendar table
CREATE TABLE public.evan_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  appointment_type TEXT DEFAULT 'call',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quick notes table
CREATE TABLE public.evan_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create communication log table for SMS and calls
CREATE TABLE public.evan_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  communication_type TEXT NOT NULL, -- 'sms' or 'call'
  direction TEXT NOT NULL, -- 'inbound' or 'outbound'
  content TEXT, -- SMS content or call notes
  phone_number TEXT,
  duration_seconds INTEGER, -- for calls
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.evan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evan_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evan_communications ENABLE ROW LEVEL SECURITY;

-- RLS policies for evan_tasks (admin only)
CREATE POLICY "Admins can manage evan tasks" 
ON public.evan_tasks FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for evan_appointments (admin only)
CREATE POLICY "Admins can manage evan appointments" 
ON public.evan_appointments FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for evan_notes (admin only)
CREATE POLICY "Admins can manage evan notes" 
ON public.evan_notes FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for evan_communications (admin only)
CREATE POLICY "Admins can manage evan communications" 
ON public.evan_communications FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_evan_tasks_updated_at
BEFORE UPDATE ON public.evan_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evan_appointments_updated_at
BEFORE UPDATE ON public.evan_appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evan_notes_updated_at
BEFORE UPDATE ON public.evan_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();