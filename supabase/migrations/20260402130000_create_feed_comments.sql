CREATE TABLE public.feed_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feed comments"
  ON public.feed_comments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_feed_comments_activity_id ON public.feed_comments(activity_id);
