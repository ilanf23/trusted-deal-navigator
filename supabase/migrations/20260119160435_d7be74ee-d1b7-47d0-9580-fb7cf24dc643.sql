-- Add new columns to evan_tasks table for the task board
ALTER TABLE public.evan_tasks 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo',
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS assignee_name TEXT DEFAULT 'Evan';

-- Update existing priority values to be numeric (1-5)
UPDATE public.evan_tasks SET priority = '3' WHERE priority = 'medium';
UPDATE public.evan_tasks SET priority = '4' WHERE priority = 'high';
UPDATE public.evan_tasks SET priority = '2' WHERE priority = 'low';
UPDATE public.evan_tasks SET priority = '3' WHERE priority IS NULL;