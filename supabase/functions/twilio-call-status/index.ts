import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioUrl: string): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY not configured, skipping transcription');
    return null;
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log('Twilio credentials not configured, cannot fetch recordings');
    return null;
  }

  try {
    console.log(`Fetching audio from: ${audioUrl}`);

    const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    // Fetch the audio file from Twilio (recording URLs require Basic Auth)
    const audioResponse = await fetch(audioUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (!audioResponse.ok) {
      console.error('Failed to fetch audio:', audioResponse.status);
      return null;
    }

    const audioBlob = await audioResponse.blob();
    console.log(`Audio fetched, size: ${audioBlob.size} bytes`);
    
    // Create form data for Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    
    console.log('Sending to OpenAI Whisper for transcription...');
    
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });
    
    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', whisperResponse.status, errorText);
      return null;
    }
    
    const result = await whisperResponse.json();
    console.log('Transcription completed, length:', result.text?.length || 0);
    
    return result.text || null;
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

// This endpoint handles call status updates AND recording status callbacks from Twilio
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
      return new Response('Missing CallSid', { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Handle recording completed callback - update the communication with the recording URL and transcription
    if (recordingStatus === 'completed' && recordingUrl) {
      console.log(`Recording completed for CallSid=${callSid}, processing...`);
      
      const mp3Url = `${recordingUrl}.mp3`;
      
      // Transcribe the audio
      const transcript = await transcribeAudio(mp3Url);
      
      // Find the communication by call_sid
      const { data: comm, error: findError } = await supabase
        .from('evan_communications')
        .select('id')
        .eq('call_sid', callSid)
        .single();

      if (findError) {
        console.log('Communication not found by call_sid, will try to find by recent calls');
        
        // Try to find by most recent call
        const { data: recentComm } = await supabase
          .from('evan_communications')
          .select('id')
          .eq('communication_type', 'call')
          .is('recording_url', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (recentComm) {
          const { error: updateError } = await supabase
            .from('evan_communications')
            .update({
              recording_url: mp3Url,
              recording_sid: recordingSid,
              duration_seconds: parseInt(recordingDuration) || null,
              transcript: transcript,
              call_sid: callSid,
            })
            .eq('id', recentComm.id);

          if (updateError) {
            console.error('Error updating communication with recording:', updateError);
          } else {
            console.log(
              transcript
                ? `Recording and transcript added to communication ${recentComm.id}`
                : `Recording saved for communication ${recentComm.id} (transcript unavailable)`
            );
          }
        }
      } else if (comm) {
        // Update with recording URL and transcript
        const { error: updateError } = await supabase
          .from('evan_communications')
          .update({
            recording_url: mp3Url,
            recording_sid: recordingSid,
            duration_seconds: parseInt(recordingDuration) || null,
            transcript: transcript,
          })
          .eq('id', comm.id);

        if (updateError) {
          console.error('Error updating communication with recording:', updateError);
        } else {
          console.log(
            transcript
              ? `Recording and transcript added to communication ${comm.id}`
              : `Recording saved for communication ${comm.id} (transcript unavailable)`
          );
        }
      }

      return new Response('OK', { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
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

      // Also log to evan_communications
      const { data: activeCall } = await supabase
        .from('active_calls')
        .select('*')
        .eq('call_sid', callSid)
        .single();

      if (activeCall) {
        // Check if communication already exists for this call
        const { data: existingComm } = await supabase
          .from('evan_communications')
          .select('id')
          .eq('call_sid', callSid)
          .single();

        if (!existingComm) {
          await supabase
            .from('evan_communications')
            .insert({
              lead_id: activeCall.lead_id,
              communication_type: 'call',
              direction: activeCall.direction,
              phone_number: activeCall.from_number,
              duration_seconds: parseInt(callDuration) || parseInt(dialCallDuration) || null,
              status: effectiveStatus,
              content: `${activeCall.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call - ${effectiveStatus}`,
              call_sid: callSid,
            });
          console.log('Communication logged with call_sid');
        } else {
          // Update existing communication with final status and duration
          await supabase
            .from('evan_communications')
            .update({
              status: effectiveStatus,
              duration_seconds: parseInt(callDuration) || parseInt(dialCallDuration) || null,
            })
            .eq('id', existingComm.id);
          console.log('Updated existing communication');
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

    return new Response('OK', { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });

  } catch (error) {
    console.error('Error in twilio-call-status function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
