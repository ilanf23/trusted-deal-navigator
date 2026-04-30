-- Race condition fix (issue #80): make communications.call_sid uniquely
-- addressable so post-call Twilio webhooks (recording, transcription) can
-- look up the exact row instead of falling back to fuzzy heuristics.

-- 1. Dedupe duplicate call_sid rows. Within each call_sid group, keep the
--    row with the most signal: prefer rows that have recording_url, then
--    transcript, then the oldest (which is usually the original write).
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY call_sid
      ORDER BY (recording_url IS NOT NULL) DESC,
               (transcript IS NOT NULL) DESC,
               created_at ASC
    ) AS rn
  FROM public.communications
  WHERE call_sid IS NOT NULL
)
DELETE FROM public.communications
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Partial unique index. NULL call_sids (legacy non-call rows: SMS, email,
--    etc.) are not constrained.
CREATE UNIQUE INDEX IF NOT EXISTS communications_call_sid_unique
  ON public.communications(call_sid)
  WHERE call_sid IS NOT NULL;
