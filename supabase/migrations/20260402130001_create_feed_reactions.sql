CREATE TABLE public.feed_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(activity_id, emoji, user_id)
);

ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feed reactions"
  ON public.feed_reactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_feed_reactions_activity_id ON public.feed_reactions(activity_id);
