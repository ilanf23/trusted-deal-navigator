-- Add source column to track where tasks originated from
ALTER TABLE public.evan_tasks 
ADD COLUMN source TEXT DEFAULT 'manual';

-- Add comment for clarity
COMMENT ON COLUMN public.evan_tasks.source IS 'Task origin: manual, gmail, lead, etc.';