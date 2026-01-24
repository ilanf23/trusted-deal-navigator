-- Create email metadata table to store deal links and next actions
CREATE TABLE public.email_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  next_action TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gmail_message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.email_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view their own email metadata"
ON public.email_metadata
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email metadata"
ON public.email_metadata
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email metadata"
ON public.email_metadata
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email metadata"
ON public.email_metadata
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_email_metadata_gmail_message_id ON public.email_metadata(gmail_message_id);
CREATE INDEX idx_email_metadata_user_id ON public.email_metadata(user_id);
CREATE INDEX idx_email_metadata_lead_id ON public.email_metadata(lead_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_metadata_updated_at
BEFORE UPDATE ON public.email_metadata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();