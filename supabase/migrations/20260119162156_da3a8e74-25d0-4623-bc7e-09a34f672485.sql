-- Create task activities table for comments, mentions, and change history
CREATE TABLE public.evan_task_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.evan_tasks(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'comment', 'status_change', 'priority_change', 'assignment', 'file_upload', 'mention'
  content TEXT,
  old_value TEXT,
  new_value TEXT,
  created_by TEXT DEFAULT 'Evan',
  mentioned_users TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task files table for attachments
CREATE TABLE public.evan_task_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.evan_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT DEFAULT 'Evan',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add group_id column to evan_tasks for custom grouping
ALTER TABLE public.evan_tasks ADD COLUMN IF NOT EXISTS group_name TEXT DEFAULT 'To Do';

-- Add tags column for categorization
ALTER TABLE public.evan_tasks ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Enable RLS
ALTER TABLE public.evan_task_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evan_task_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for activities
CREATE POLICY "Admins can manage evan task activities"
  ON public.evan_task_activities
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for files
CREATE POLICY "Admins can manage evan task files"
  ON public.evan_task_files
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for activities
ALTER PUBLICATION supabase_realtime ADD TABLE public.evan_task_activities;