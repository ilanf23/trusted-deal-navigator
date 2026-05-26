-- Add explicit recording + transcription status tracking so a NULL transcript
-- no longer collapses several distinct failure modes (recording not requested,
-- recording pending, Whisper failed, no recording produced) into one ambiguous
-- "no transcript yet" state. Surfacing these on communications lets the
-- sidebar modal and /admin/calls render accurate status copy and lets admins
-- target retries appropriately.

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS recording_status text,
  ADD COLUMN IF NOT EXISTS transcription_status text,
  ADD COLUMN IF NOT EXISTS transcription_error text,
  ADD COLUMN IF NOT EXISTS transcription_updated_at timestamp with time zone;

-- Status vocabulary documented at the column level so callers (edge functions,
-- UI) treat values consistently:
--   recording_status:     not_requested | pending | available | not_found
--   transcription_status: not_requested | pending | processing | completed | failed
COMMENT ON COLUMN public.communications.recording_status IS
  'One of: not_requested, pending, available, not_found.';
COMMENT ON COLUMN public.communications.transcription_status IS
  'One of: not_requested, pending, processing, completed, failed.';
COMMENT ON COLUMN public.communications.transcription_error IS
  'Sanitized last-error message when transcription_status = failed.';
COMMENT ON COLUMN public.communications.transcription_updated_at IS
  'Timestamp of the last transition on transcription_status.';

-- Backfill: rows that already have a non-empty transcript are 'completed'.
-- Rows that have a recording_url but no transcript are 'pending' (will be
-- picked up by the existing manual-retry flow). Everything else stays NULL so
-- a future write can set the appropriate initial state without us
-- mis-classifying legacy rows.
UPDATE public.communications
SET
  recording_status = CASE
    WHEN recording_url IS NOT NULL AND length(trim(recording_url)) > 0 THEN 'available'
    ELSE recording_status
  END,
  transcription_status = CASE
    WHEN transcript IS NOT NULL AND length(trim(transcript)) > 0 THEN 'completed'
    WHEN recording_url IS NOT NULL AND length(trim(recording_url)) > 0 THEN 'pending'
    ELSE transcription_status
  END,
  transcription_updated_at = COALESCE(transcription_updated_at, now())
WHERE communication_type = 'call';
