-- Add team_member_name column to evan_appointments to track ownership
ALTER TABLE public.evan_appointments 
ADD COLUMN IF NOT EXISTS team_member_name text DEFAULT 'evan';

-- Update existing appointments that were imported from Ilan's calendar
-- We can identify them by looking at the calendar_connections and matching google_calendar_id
UPDATE public.evan_appointments ea
SET team_member_name = cc.team_member_name
FROM public.calendar_connections cc
WHERE ea.google_calendar_id = cc.calendar_id
  AND cc.team_member_name IS NOT NULL;

-- For appointments with no team_member set, try to match by user who created them
-- Default ones without a match to 'evan'
UPDATE public.evan_appointments
SET team_member_name = 'evan'
WHERE team_member_name IS NULL;