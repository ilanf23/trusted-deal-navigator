-- Drop old Google OAuth connection tables.
-- Only run AFTER verifying the unified google_connections table works correctly.
DROP TABLE IF EXISTS public.calendar_connections;
DROP TABLE IF EXISTS public.gmail_connections;
DROP TABLE IF EXISTS public.sheets_connections;
