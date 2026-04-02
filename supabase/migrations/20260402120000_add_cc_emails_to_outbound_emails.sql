-- Add cc_emails column to outbound_emails for tracking CC recipients
ALTER TABLE outbound_emails ADD COLUMN IF NOT EXISTS cc_emails text;
