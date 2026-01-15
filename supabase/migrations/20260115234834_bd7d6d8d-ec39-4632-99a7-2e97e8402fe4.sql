-- Drop the existing foreign key constraint on subscriber_id
ALTER TABLE public.newsletter_campaign_events 
DROP CONSTRAINT IF EXISTS newsletter_campaign_events_subscriber_id_fkey;

-- Rename the column to lead_id for clarity (optional but cleaner)
-- Actually, let's keep subscriber_id but remove the FK constraint
-- This allows tracking both leads and subscribers

-- Add a comment to clarify the column usage
COMMENT ON COLUMN public.newsletter_campaign_events.subscriber_id IS 'Can be either a lead_id or newsletter_subscriber_id';