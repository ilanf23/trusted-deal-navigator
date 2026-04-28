import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

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
 * Prefix each line of a transcript with speaker labels based on call direction.
 * For outbound calls Evan speaks first; for inbound the caller speaks first.
 */
function addSpeakerLabels(text: string, direction: string): string {
  if (!text) return text;
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const isOutbound = direction === 'outbound';
  return lines
    .map((line, i) => {
      const speaker = (i % 2 === 0) === isOutbound ? 'Evan' : 'Caller';
      return `${speaker}: ${line.trim()}`;
    })
    .join('\n');
}

/**
 * Download an MP3 recording from Twilio and transcribe it via OpenAI Whisper.
 * Returns the labelled transcript string or null on any failure.
 */
async function transcribeAudio(mp3Url: string, direction: string): Promise<string | null> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.error('OPENAI_API_KEY not set – skipping transcription');
    return null;
  }

  try {
    // Download the recording
    const audioResp = await fetch(mp3Url);
    if (!audioResp.ok) {
      console.error(`Failed to download recording: ${audioResp.status}`);
      return null;
    }
    const audioBlob = await audioResp.blob();

    // Send to Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!whisperResp.ok) {
      console.error(`Whisper API error: ${whisperResp.status}`);
      return null;
    }

    const rawText = await whisperResp.text();
    return addSpeakerLabels(rawText.trim(), direction);
  } catch (err) {
    console.error('Transcription failed:', err);
    return null;
  }
}

// This endpoint handles call status updates AND recording status callbacks from Twilio
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-call-status', 300, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data from Twilio webhook
    const formData = await req.formData().catch(() => null);

    const callSid = formData?.get('CallSid')?.toString() || '';
    const callStatus = formData?.get('CallStatus')?.toString() || '';
    const callDuration = formData?.get('CallDuration')?.toString() || '0';

    // Recording-specific fields (present for recording status callbacks)
    const recordingUrl = formData?.get('RecordingUrl')?.toString() || '';
    const recordingSid = formData?.get('RecordingSid')?.toString() || '';
    const recordingStatus = formData?.get('RecordingStatus')?.toString() || '';
    const recordingDuration = formData?.get('RecordingDuration')?.toString() || '';

    // Dial-specific fields (present for status callbacks from <Dial>)
    const dialCallStatus = formData?.get('DialCallStatus')?.toString() || '';
    const dialCallSid = formData?.get('DialCallSid')?.toString() || '';
    const dialCallDuration = formData?.get('DialCallDuration')?.toString() || '';

    // From/To are present on per-Number statusCallbacks (used as the outbound
    // backstop when no active_calls row exists for this call_sid).
    const fromNumber = formData?.get('From')?.toString() || '';
    const toNumber = formData?.get('To')?.toString() || '';

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

    // Handle recording completed callback - save recording URL (no automatic transcription)
    if (recordingStatus === 'completed' && recordingUrl) {
      console.log(`Recording completed for CallSid=${callSid}, saving recording info...`);
      
      const mp3Url = `${recordingUrl}.mp3`;
      
      // Find the communication by call_sid
      const { data: comm, error: findError } = await supabase
        .from('communications')
        .select('id')
        .eq('call_sid', callSid)
        .single();

      if (findError) {
        console.log('Communication not found by call_sid, will try to find by recent calls');
        
        // Try to find by most recent call
        const { data: recentComm } = await supabase
          .from('communications')
          .select('id')
          .eq('communication_type', 'call')
          .is('recording_url', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (recentComm) {
          const { error: updateError } = await supabase
            .from('communications')
            .update({
              recording_url: mp3Url,
              recording_sid: recordingSid,
              duration_seconds: parseInt(recordingDuration) || null,
              call_sid: callSid,
            })
            .eq('id', recentComm.id);

          if (updateError) {
            console.error('Error updating communication with recording:', updateError);
          } else {
            console.log(`Recording saved for communication ${recentComm.id}`);
          }
        }
      } else if (comm) {
        const { error: updateError } = await supabase
          .from('communications')
          .update({
            recording_url: mp3Url,
            recording_sid: recordingSid,
            duration_seconds: parseInt(recordingDuration) || null,
          })
          .eq('id', comm.id);

        if (updateError) {
          console.error('Error updating communication with recording:', updateError);
        } else {
          console.log(`Recording saved for communication ${comm.id}`);
        }
      }

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

    if (['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled'].includes(effectiveStatus)) {
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
        // Inbound completion path: client never inserted a communications row,
        // create it now using metadata captured at webhook time.
        await supabase
          .from('communications')
          .insert({
            lead_id: activeCall.lead_id,
            communication_type: 'call',
            direction: activeCall.direction,
            phone_number: activeCall.from_number,
            duration_seconds: finalDuration,
            status: effectiveStatus,
            content: `${activeCall.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call - ${effectiveStatus}`,
            call_sid: callSid,
            user_id: activeCall.user_id || null,
          });
        console.log('Communication logged from active_call');
      } else {
        // Outbound backstop: no active_calls row exists and the client-side
        // insert never landed (e.g. tab closed before insert completed).
        // Insert what we can derive from the webhook payload so the call still
        // shows up in history. user_id is unknown server-side and stays null —
        // the Calls.tsx history query allows null user_id as a safety net.
        await supabase
          .from('communications')
          .insert({
            lead_id: null,
            communication_type: 'call',
            direction: 'outbound',
            phone_number: toNumber || fromNumber || null,
            duration_seconds: finalDuration,
            status: effectiveStatus,
            content: `Outgoing call - ${effectiveStatus}`,
            call_sid: callSid,
            user_id: null,
          });
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

    const { error } = await supabase
      .from('active_calls')
      .update(updateData)
      .eq('call_sid', callSid);

    if (error) {
      console.error('Error updating call status:', error);
    }

    return new Response(okTwiML(), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Error in twilio-call-status function:', error);
    // Still return valid TwiML so Twilio never falls back to a provider voice/flow.
    return new Response(okTwiML(), { status: 200, headers: corsHeaders });
  }
});
