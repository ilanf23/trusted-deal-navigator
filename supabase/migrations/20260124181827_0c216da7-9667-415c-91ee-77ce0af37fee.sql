-- Add additional fields to email_metadata for explanation system
ALTER TABLE public.email_metadata
ADD COLUMN IF NOT EXISTS waiting_on TEXT CHECK (waiting_on IN ('borrower', 'lender', 'internal', NULL)),
ADD COLUMN IF NOT EXISTS sla_breach BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sla_due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_fyi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMP WITH TIME ZONE;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_email_metadata_waiting_on ON public.email_metadata(waiting_on);
CREATE INDEX IF NOT EXISTS idx_email_metadata_sla_breach ON public.email_metadata(sla_breach) WHERE sla_breach = true;