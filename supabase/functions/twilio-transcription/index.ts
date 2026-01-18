import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Find the most recent communication for this call
    // Match by phone number and approximate time
    let commQuery = supabase
      .from('evan_communications')
      .select('*')
      .eq('communication_type', 'call')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activeCall?.from_number) {
      const normalizedPhone = activeCall.from_number.replace(/\D/g, '').slice(-10);
      commQuery = supabase
        .from('evan_communications')
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

    // Update the most recent matching communication with the transcript
    if (recentComms && recentComms.length > 0) {
      const commToUpdate = recentComms[0];
      
      // Build the updated content with transcript
      const existingContent = commToUpdate.content || '';
      const updatedContent = existingContent.includes('Transcript:') 
        ? existingContent 
        : `${existingContent}\n\n--- Transcript ---\n${transcriptionText}`.trim();

      const { error: updateError } = await supabase
        .from('evan_communications')
        .update({ 
          content: updatedContent,
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
        .from('evan_communications')
        .insert({
          lead_id: activeCall?.lead_id || null,
          communication_type: 'call',
          direction: activeCall?.direction || 'inbound',
          phone_number: activeCall?.from_number || null,
          content: `Call transcript:\n\n${transcriptionText}`,
          status: 'transcribed',
        });

      if (insertError) {
        console.error('Error creating communication with transcript:', insertError);
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
