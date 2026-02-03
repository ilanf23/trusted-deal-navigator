-- Add task_type column to evan_tasks for categorizing tasks
ALTER TABLE public.evan_tasks 
ADD COLUMN task_type text DEFAULT 'internal' CHECK (task_type IN ('call', 'email', 'internal'));