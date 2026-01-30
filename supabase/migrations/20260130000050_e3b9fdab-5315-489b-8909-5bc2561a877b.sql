-- Add 'lost' status to the lead_status enum for dead/lost leads
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'lost';