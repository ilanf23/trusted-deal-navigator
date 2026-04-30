import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { verifyTwilioSignature } from '../_shared/twilioSignature.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// This endpoint handles transcription callbacks from Twilio
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-transcription', 300, 60);
  if (rateLimitResponse) return rateLimitResponse;

  const verified = await verifyTwilioSignature(req, corsHeaders);
  if (!verified.ok) return verified.response;
  const params = verified.params;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const callSid = params.get('CallSid') ?? '';
    const transcriptionSid = params.get('TranscriptionSid') ?? '';
    const transcriptionText = params.get('TranscriptionText') ?? '';
    const transcriptionStatus = params.get('TranscriptionStatus') ?? '';
    const transcriptionUrl = params.get('TranscriptionUrl') ?? '';
    const recordingUrl = params.get('RecordingUrl') ?? '';
    const recordingSid = params.get('RecordingSid') ?? '';

    console.log(`Transcription received: CallSid=${callSid} Status=${transcriptionStatus}`);
    console.log(`TranscriptionSid=${transcriptionSid}`);
    console.log(`RecordingSid=${recordingSid}`);
    console.log(`RecordingUrl=${recordingUrl}`);
    console.log(`TranscriptionText length=${transcriptionText.length}`);
    console.log(`TranscriptionText preview: ${transcriptionText.substring(0, 200)}...`);

    if (!callSid) {
      console.log('Missing CallSid');
      return new Response('Missing CallSid', { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    if (transcriptionStatus !== 'completed') {
      console.log(`Transcription status is ${transcriptionStatus}, not completed`);
      return new Response('OK', { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Exact lookup by call_sid only — no fuzzy fallback. If the row is not
    // found, return 503 so Twilio retries (transcripts retried ~5 times over
    // ~15 min). Fuzzy phone-number fallbacks attached transcripts to wrong
    // rows under concurrent calls. See issue #80.
    const { data: comm, error: lookupErr } = await supabase
      .from('communications')
      .select('id')
      .eq('call_sid', callSid)
      .maybeSingle();

    if (lookupErr) {
      console.error('[twilio-transcription] lookup error:', lookupErr);
      return new Response('Lookup error', {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    if (!comm) {
      console.warn(
        '[twilio-transcription] no communications row for call_sid — returning 503 for Twilio retry',
        { callSid },
      );
      return new Response('Comm row not found', {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const { error: updateError } = await supabase
      .from('communications')
      .update({
        transcript: transcriptionText,
        recording_url: recordingUrl || null,
        recording_sid: recordingSid || null,
      })
      .eq('id', comm.id);

    if (updateError) {
      console.error('[twilio-transcription] update failed:', updateError);
      return new Response('Update error', {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    console.log(`[twilio-transcription] transcript saved for communication ${comm.id}`);
    return new Response('OK', { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });

  } catch (error) {
    console.error('Error in twilio-transcription function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
