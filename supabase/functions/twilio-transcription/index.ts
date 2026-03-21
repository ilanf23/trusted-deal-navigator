import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data from Twilio webhook
    const formData = await req.formData().catch(() => null);

    const callSid = formData?.get('CallSid')?.toString() || '';
    const transcriptionSid = formData?.get('TranscriptionSid')?.toString() || '';
    const transcriptionText = formData?.get('TranscriptionText')?.toString() || '';
    const transcriptionStatus = formData?.get('TranscriptionStatus')?.toString() || '';
    const transcriptionUrl = formData?.get('TranscriptionUrl')?.toString() || '';
    const recordingUrl = formData?.get('RecordingUrl')?.toString() || '';
    const recordingSid = formData?.get('RecordingSid')?.toString() || '';

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

    // Find the active call record
    const { data: activeCall, error: callError } = await supabase
      .from('active_calls')
      .select('*')
      .eq('call_sid', callSid)
      .single();

    if (callError) {
      console.error('Error finding active call:', callError);
    }

    // First try to find by call_sid directly
    let commToUpdate = null;
    
    const { data: commByCallSid } = await supabase
      .from('communications')
      .select('*')
      .eq('call_sid', callSid)
      .single();

    if (commByCallSid) {
      commToUpdate = commByCallSid;
      console.log(`Found communication by call_sid: ${commByCallSid.id}`);
    } else {
      // Fallback: Find the most recent communication for this call by phone number
      let commQuery = supabase
        .from('communications')
        .select('*')
        .eq('communication_type', 'call')
        .order('created_at', { ascending: false })
        .limit(10);

      if (activeCall?.from_number) {
        const normalizedPhone = activeCall.from_number.replace(/\D/g, '').slice(-10);
        commQuery = supabase
          .from('communications')
          .select('*')
          .eq('communication_type', 'call')
          .or(`phone_number.ilike.%${normalizedPhone}%`)
          .order('created_at', { ascending: false })
          .limit(5);
      }

      const { data: recentComms, error: commError } = await commQuery;

      if (commError) {
        console.error('Error finding communications:', commError);
      }

      if (recentComms && recentComms.length > 0) {
        commToUpdate = recentComms[0];
        console.log(`Found communication by phone number: ${commToUpdate.id}`);
      }
    }

    // Update the matching communication with the transcript
    if (commToUpdate) {
      const { error: updateError } = await supabase
        .from('communications')
        .update({ 
          transcript: transcriptionText,
          recording_url: recordingUrl || null,
          recording_sid: recordingSid || null,
          call_sid: callSid,
        })
        .eq('id', commToUpdate.id);

      if (updateError) {
        console.error('Error updating communication with transcript:', updateError);
      } else {
        console.log(`Transcript added to communication ${commToUpdate.id}`);
      }
    } else {
      // If no matching communication found, create one
      console.log('No matching communication found, creating new record');
      
      const { error: insertError } = await supabase
        .from('communications')
        .insert({
          lead_id: activeCall?.lead_id || null,
          communication_type: 'call',
          direction: activeCall?.direction || 'inbound',
          phone_number: activeCall?.from_number || null,
          content: 'Call with transcript',
          transcript: transcriptionText,
          recording_url: recordingUrl || null,
          recording_sid: recordingSid || null,
          call_sid: callSid,
          status: 'transcribed',
        });

      if (insertError) {
        console.error('Error creating communication with transcript:', insertError);
      } else {
        console.log('Created new communication with transcript');
      }
    }

    return new Response('OK', { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });

  } catch (error) {
    console.error('Error in twilio-transcription function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
