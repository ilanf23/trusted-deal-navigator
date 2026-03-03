CREATE TABLE public.activity_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.lead_activities(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage activity comments"
  ON public.activity_comments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_activity_comments_activity_id ON public.activity_comments(activity_id);
CREATE INDEX idx_activity_comments_lead_id ON public.activity_comments(lead_id);
