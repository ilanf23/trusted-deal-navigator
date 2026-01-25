-- Create table for email templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  team_member_name TEXT DEFAULT 'Evan',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read templates
CREATE POLICY "Authenticated users can read email templates"
ON public.email_templates
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow admins to manage templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default templates
INSERT INTO public.email_templates (name, subject, body, category) VALUES
('Initial Outreach', 'Commercial Lending Opportunity', 'Hi, I wanted to reach out about financing options that could help grow your business.', 'outreach'),
('Follow-Up', 'Following Up on Our Conversation', 'Just checking in to see if you had any questions about the loan options we discussed.', 'follow_up'),
('Document Request', 'Documents Needed for Your Application', 'To move forward with your application, please provide the following documents at your earliest convenience.', 'documents'),
('Rate Update', 'Great News - Rates Have Changed', 'I wanted to let you know that rates have moved favorably and now might be a good time to revisit your financing.', 'rate_alert'),
('Thank You', 'Thank You for Your Business', 'Thank you for choosing us for your financing needs - please don''t hesitate to reach out if you need anything.', 'thank_you');

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();