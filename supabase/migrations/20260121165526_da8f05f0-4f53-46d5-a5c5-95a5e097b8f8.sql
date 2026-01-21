-- Add new columns to lender_programs table to match user's data structure
ALTER TABLE public.lender_programs 
ADD COLUMN IF NOT EXISTS call_status text DEFAULT 'N',
ADD COLUMN IF NOT EXISTS last_contact timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_call timestamp with time zone,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS looking_for text,
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS lender_type text,
ADD COLUMN IF NOT EXISTS loan_types text,
ADD COLUMN IF NOT EXISTS states text;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_lender_programs_call_status ON public.lender_programs(call_status);
CREATE INDEX IF NOT EXISTS idx_lender_programs_next_call ON public.lender_programs(next_call);