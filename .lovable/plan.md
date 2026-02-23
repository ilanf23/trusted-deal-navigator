

## Change: Only Run Rating Automation When "Generate Transcript" Is Pressed

### Current Flow
1. Call ends -- recording is saved, transcription happens automatically in `twilio-call-status`
2. Evan clicks "Add as Lead" on a call -- lead is created in the database
3. A confirmation dialog appears asking "Run automation?" -- if confirmed, `call-to-lead-automation` fires (AI rating, task creation, Gmail draft, Resend email to Adam/Ilan, database notification)

The Slack alerts in `twilio-inbound` are operational routing alerts (not related to call ratings) and will remain unchanged.

### Desired Flow
1. Call ends -- recording is saved (no automatic transcription or automation)
2. Evan clicks "Add as Lead" -- lead is created, but NO automation dialog appears
3. Evan clicks "Generate Transcript" on a call that has a recording -- transcript is generated AND THEN the rating automation runs (AI rating, task, Gmail draft, email notification, Slack)

### Changes

**1. `src/pages/admin/EvansCalls.tsx`**

- Remove the automation confirmation dialog trigger from `addLeadMutation.onSuccess` -- stop calling `setPendingAutomationData(...)` and `setAutomationConfirmOpen(true)` after creating a lead
- Move the automation trigger into `handleGenerateTranscript` -- after transcript is successfully generated, check if the call has a linked `lead_id`. If it does, automatically invoke `call-to-lead-automation` with the fresh transcript
- Keep the automation confirmation dialog UI but wire it to fire after transcript generation instead

**2. `supabase/functions/twilio-call-status/index.ts`**

- Remove the automatic `transcribeAudio` call inside the `recordingStatus === 'completed'` handler -- still save the `recording_url` and `recording_sid`, but skip the Whisper transcription step
- This ensures transcription only happens when Evan explicitly clicks "Generate Transcript"

### Technical Details

In `EvansCalls.tsx`, the updated `handleGenerateTranscript` will:
1. Call `retry-call-transcription` (existing behavior)
2. On success, look up the call's `lead_id` from the refreshed call history
3. If a lead is linked, populate `pendingAutomationData` and show the automation confirmation dialog
4. If no lead is linked, just show a success toast for the transcript

In `twilio-call-status`, the recording handler will be simplified to:
1. Save `recording_url`, `recording_sid`, `duration_seconds` to `evan_communications`
2. Skip the `transcribeAudio()` call entirely
3. The transcript field stays `null` until the user clicks "Generate Transcript"

No changes needed to `call-to-lead-automation` edge function or `twilio-inbound` (the Slack alerts there are operational, not rating-related).
