import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

function okTwiML() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;
}

// Add speaker labels using GPT
async function addSpeakerLabels(rawTranscript: string, direction: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) return rawTranscript;

  const isInbound = direction === 'inbound';
  const party1 = isInbound ? 'Caller' : 'Evan';
  const party2 = isInbound ? 'Evan' : 'Caller';

  const systemPrompt = `You are a transcript formatter. Given a raw phone call transcript, your job is to:
1. Identify which parts were spoken by each party
2. Format it as a clean dialogue with speaker labels

The call is ${isInbound ? 'an inbound call (customer called Evan)' : 'an outbound call (Evan called the customer)'}.
- "${party1}" is the person who initiated the call
- "${party2}" is the other party

Rules:
- Use "${party1}:" and "${party2}:" as speaker labels
- Each speaker's turn should be on its own line
- Infer speakers based on context: greetings, questions vs answers, professional vs casual tone
- Keep the original words, just add speaker labels and line breaks
- Do NOT add any commentary, just return the formatted transcript`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawTranscript }
        ],
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      console.error('GPT speaker labeling failed');
      return rawTranscript;
    }

    const json = await resp.json();
    return json.choices?.[0]?.message?.content || rawTranscript;
  } catch (error) {
    console.error('Speaker labeling error:', error);
    return rawTranscript;
  }
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioUrl: string, direction: string): Promise<string | null> {
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
    const rawTranscript = result.text || null;
    console.log('Transcription completed, length:', rawTranscript?.length || 0);
    
    // Add speaker labels
    if (rawTranscript) {
      console.log('Adding speaker labels...');
      const labeledTranscript = await addSpeakerLabels(rawTranscript, direction);
      console.log('Speaker labeling completed');
      return labeledTranscript;
    }
    
    return rawTranscript;
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
      return new Response(okTwiML(), { status: 200, headers: corsHeaders });
    }

    // Handle recording completed callback - update the communication with the recording URL and transcription
    if (recordingStatus === 'completed' && recordingUrl) {
      console.log(`Recording completed for CallSid=${callSid}, processing...`);
      
      const mp3Url = `${recordingUrl}.mp3`;
      
      // Get call direction from active_calls
      const { data: activeCallForDir } = await supabase
        .from('active_calls')
        .select('direction')
        .eq('call_sid', callSid)
        .maybeSingle();
      
      const callDirection = activeCallForDir?.direction || 'inbound';
      
      // Transcribe the audio with speaker labels
      const transcript = await transcribeAudio(mp3Url, callDirection);
      
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

        // Update lead's last_activity_at for scorecard tracking
        if (activeCall.lead_id) {
          const { error: leadError } = await supabase
            .from('leads')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', activeCall.lead_id);

          if (leadError) {
            console.error('Failed to update lead last_activity_at:', leadError);
          } else {
            console.log(`Updated last_activity_at for lead ${activeCall.lead_id}`);
          }
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
