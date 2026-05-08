import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { verifyTwilioSignature } from '../_shared/twilioSignature.ts';
import { transcribeCommunication } from '../_shared/transcription.ts';

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

/** Return a minimal valid TwiML so Twilio never falls back to its default voice. */
function okTwiML(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}

/**
 * Schedule a fire-and-forget background transcription. Uses Deno Edge Runtime's
 * waitUntil when available so the worker isn't torn down before the pipeline
 * resolves. Falls back to a detached promise in environments without it
 * (local supabase functions serve, certain test runners) so callers don't
 * need to branch.
 */
function scheduleBackgroundTranscription(
  supabase: ReturnType<typeof createClient>,
  communicationId: string,
): void {
  const work = transcribeCommunication(supabase, communicationId, { skipIfPresent: true })
    .then((res) => {
      if (!res.ok) {
        console.error(
          '[twilio-call-status] background transcription failed:',
          res.error,
          { communicationId },
        );
      } else if (res.alreadyPresent) {
        console.log(
          '[twilio-call-status] background transcription skipped (already present)',
          { communicationId },
        );
      } else {
        console.log(
          '[twilio-call-status] background transcription complete',
          { communicationId },
        );
      }
    })
    .catch((err) => {
      console.error('[twilio-call-status] background transcription error:', err, { communicationId });
    });

  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    EdgeRuntime.waitUntil(work);
  }
  // else: promise runs detached — acceptable fallback for local dev.
}

// This endpoint handles call status updates AND recording status callbacks from Twilio
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify Twilio signature first — sub-millisecond HMAC check that rejects
  // unauthenticated POSTs before they trigger any DB writes (issues #78, #2/#3).
  // The helper consumes the body and returns URLSearchParams; do not call
  // req.formData() afterward.
  const verified = await verifyTwilioSignature(req, corsHeaders);
  if (!verified.ok) return verified.response;
  const params = verified.params;

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-call-status', 300, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const callSid = params.get('CallSid') ?? '';
    const callStatus = params.get('CallStatus') ?? '';
    const callDuration = params.get('CallDuration') ?? '0';

    // Recording-specific fields (present for recording status callbacks)
    const recordingUrl = params.get('RecordingUrl') ?? '';
    const recordingSid = params.get('RecordingSid') ?? '';
    const recordingStatus = params.get('RecordingStatus') ?? '';
    const recordingDuration = params.get('RecordingDuration') ?? '';

    // Dial-specific fields (present for status callbacks from <Dial>)
    const dialCallStatus = params.get('DialCallStatus') ?? '';
    const dialCallSid = params.get('DialCallSid') ?? '';
    const dialCallDuration = params.get('DialCallDuration') ?? '';

    // From/To are present on per-Number statusCallbacks (used as the outbound
    // backstop when no active_calls row exists for this call_sid).
    const fromNumber = params.get('From') ?? '';
    const toNumber = params.get('To') ?? '';

    console.log(
      `Twilio callback: CallSid=${callSid} CallStatus=${callStatus} CallDuration=${callDuration}s`
    );
    console.log(
      `Recording: Status=${recordingStatus} Sid=${recordingSid} Duration=${recordingDuration}s Url=${recordingUrl}`
    );
    console.log(
      `Dial: Status=${dialCallStatus} Sid=${dialCallSid} Duration=${dialCallDuration}s`
    );

    if (!callSid) {
      return new Response(okTwiML(), { status: 200, headers: corsHeaders });
    }

    // Handle recording completed callback - save recording URL and schedule
    // background transcription. We no longer require an admin to manually
    // click Retry to get a transcript on every recording.
    if (recordingStatus === 'completed' && recordingUrl) {
      console.log(`Recording completed for CallSid=${callSid}, saving recording info...`);

      const mp3Url = `${recordingUrl}.mp3`;

      // Exact lookup by call_sid only — no fuzzy fallback. If the row is not
      // found yet, return 503 so Twilio retries (recordings are valid for
      // weeks; Twilio retries ~5 times over ~15 min). See issue #80.
      const { data: comm, error: findError } = await supabase
        .from('communications')
        .select('id')
        .eq('call_sid', callSid)
        .maybeSingle();

      if (findError) {
        console.error('[twilio-call-status] recording lookup error:', findError);
        return new Response('Lookup error', { status: 503, headers: corsHeaders });
      }

      if (!comm) {
        console.warn(
          '[twilio-call-status] no communications row for call_sid yet — returning 503 for Twilio retry',
          { callSid },
        );
        return new Response('Comm row not found', { status: 503, headers: corsHeaders });
      }

      const { error: updateError } = await supabase
        .from('communications')
        .update({
          recording_url: mp3Url,
          recording_sid: recordingSid,
          duration_seconds: parseInt(recordingDuration) || null,
        })
        .eq('id', comm.id);

      if (updateError) {
        console.error('[twilio-call-status] recording update failed:', updateError);
        return new Response('Update error', { status: 503, headers: corsHeaders });
      }

      console.log(`[twilio-call-status] recording saved for communication ${comm.id}`);

      // Fire-and-forget transcription. Skip if a transcript is somehow already
      // present (e.g. admin clicked Retry while the recording-completed
      // callback was retrying). Errors are logged inside the helper.
      scheduleBackgroundTranscription(supabase, comm.id);

      return new Response(okTwiML(), { status: 200, headers: corsHeaders });
    }

    // Prefer DialCallStatus if present (it describes the <Dial> leg result)
    const effectiveStatus = dialCallStatus || callStatus;

    // Update the active call status
    const updateData: Record<string, unknown> = {
      status: effectiveStatus,
    };

    if (effectiveStatus === 'in-progress') {
      updateData.answered_at = new Date().toISOString();
    }

    if (['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled', 'declined'].includes(effectiveStatus)) {
      updateData.ended_at = new Date().toISOString();

      // Look up the active_calls row (only inbound calls create one) and any
      // existing communications row keyed by call_sid (outbound calls insert
      // this client-side at initiation).
      const { data: activeCall } = await supabase
        .from('active_calls')
        .select('*')
        .eq('call_sid', callSid)
        .maybeSingle();

      const { data: existingComm } = await supabase
        .from('communications')
        .select('id')
        .eq('call_sid', callSid)
        .maybeSingle();

      const finalDuration = parseInt(callDuration) || parseInt(dialCallDuration) || null;

      if (existingComm) {
        // Always safe to finalize an existing row regardless of which path
        // (inbound active_calls vs outbound client-insert) created it.
        await supabase
          .from('communications')
          .update({
            status: effectiveStatus,
            duration_seconds: finalDuration,
          })
          .eq('id', existingComm.id);
        console.log('Updated existing communication');
      } else if (activeCall) {
        // Defensive fallback: twilio-inbound's synchronous communications
        // upsert should have created this row at call-start. Reaching this
        // path means that upsert failed — log loudly so it gets noticed.
        // Use upsert with onConflict to no-op if a row was created concurrently.
        console.warn(
          '[twilio-call-status] inbound communications row missing — twilio-inbound upsert may have failed',
          { callSid },
        );
        await supabase
          .from('communications')
          .upsert(
            {
              lead_id: activeCall.lead_id,
              communication_type: 'call',
              direction: activeCall.direction,
              phone_number: activeCall.from_number,
              duration_seconds: finalDuration,
              status: effectiveStatus,
              content: `${activeCall.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call - ${effectiveStatus}`,
              call_sid: callSid,
              user_id: activeCall.user_id || null,
            },
            { onConflict: 'call_sid', ignoreDuplicates: true },
          );
        console.log('Communication logged from active_call');
      } else {
        // Defensive outbound backstop: no active_calls row and the client-side
        // insert never landed (e.g. tab closed before insert completed). user_id
        // and lead_id are unknown server-side. Both upstream writes failing is
        // unusual — log loudly.
        console.warn(
          '[twilio-call-status] no communications and no active_calls row — outbound client insert + active_calls write both missed',
          { callSid },
        );
        await supabase
          .from('communications')
          .upsert(
            {
              lead_id: null,
              communication_type: 'call',
              direction: 'outbound',
              phone_number: toNumber || fromNumber || null,
              duration_seconds: finalDuration,
              status: effectiveStatus,
              content: `Outgoing call - ${effectiveStatus}`,
              call_sid: callSid,
              user_id: null,
            },
            { onConflict: 'call_sid', ignoreDuplicates: true },
          );
        console.log('Communication logged as outbound backstop (no active_call)');
      }

      // Update lead's last_activity_at for scorecard tracking
      if (activeCall?.lead_id) {
        const { error: leadError } = await supabase
          .from('people')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', activeCall.lead_id);

        if (leadError) {
          console.error('Failed to update lead last_activity_at:', leadError);
        } else {
          console.log(`Updated last_activity_at for lead ${activeCall.lead_id}`);
        }
      }
    }

    // For terminal statuses we drop the active_calls row entirely — history
    // lives in `communications`. Keeping completed rows in active_calls
    // pollutes the live-state table and breaks the UI's "active call" panel
    // semantics. For non-terminal transitions (ringing → in-progress) we
    // still update in place so realtime listeners pick up the new status.
    if (['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled', 'declined'].includes(effectiveStatus)) {
      const { error: delError } = await supabase
        .from('active_calls')
        .delete()
        .eq('call_sid', callSid);
      if (delError) {
        console.error('[twilio-call-status] active_calls delete failed:', delError);
      }
    } else {
      const { error: updError } = await supabase
        .from('active_calls')
        .update(updateData)
        .eq('call_sid', callSid);
      if (updError) {
        console.error('Error updating call status:', updError);
      }
    }

    return new Response(okTwiML(), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error in twilio-call-status function:', error);
    // Still return valid TwiML so Twilio never falls back to a provider voice/flow.
    return new Response(okTwiML(), { status: 200, headers: corsHeaders });
  }
});
