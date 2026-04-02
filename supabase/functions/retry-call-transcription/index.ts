import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function fetchTwilioRecordingAsBlob(recordingUrl: string): Promise<Blob> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
  const basicAuth = btoa(`${accountSid}:${authToken}`);

  // Ensure we request the .mp3 format
  let url = recordingUrl;
  if (!url.endsWith('.mp3') && !url.endsWith('.wav')) {
    url = url + '.mp3';
  }

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${basicAuth}` },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recording: ${response.status} ${response.statusText}`);
  }

  return await response.blob();
}

async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper transcription failed: ${err}`);
  }

  return await response.text();
}

async function addSpeakerLabels(rawTranscript: string, direction: string): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    return rawTranscript;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a transcript formatter. Add speaker labels to the following call transcript. The call direction is "${direction}". For inbound calls, the external caller speaks first. For outbound calls, our team member (Evan) speaks first. Label speakers as "Evan:" and "Caller:" on each line. Return ONLY the labeled transcript, no other text.`,
          },
          { role: 'user', content: rawTranscript },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Speaker labeling failed:', await response.text());
      return rawTranscript;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || rawTranscript;
  } catch (err) {
    console.error('Speaker labeling error:', err);
    return rawTranscript;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'retry-call-transcription', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';

    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userSupabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const { data: role } = await adminSupabase
      .from('users')
      .select('app_role')
      .eq('user_id', userData.user.id)
      .in('app_role', ['admin', 'super_admin'])
      .maybeSingle();

    if (!role) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => ({}));
    const communicationId = body?.communicationId as string | undefined;

    if (!communicationId) {
      return new Response(JSON.stringify({ error: 'Missing communicationId' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: comm, error: commErr } = await adminSupabase
      .from('communications')
      .select('id, communication_type, recording_url, transcript, call_sid, direction')
      .eq('id', communicationId)
      .single();

    if (commErr || !comm) {
      return new Response(JSON.stringify({ error: 'Call not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (comm.communication_type !== 'call') {
      return new Response(JSON.stringify({ error: 'Not a call record' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch direction from active_calls if not on the communication record
    let direction = comm.direction || 'inbound';
    if (comm.call_sid) {
      const { data: activeCall } = await adminSupabase
        .from('active_calls')
        .select('direction')
        .eq('call_sid', comm.call_sid)
        .maybeSingle();
      
      if (activeCall?.direction) {
        direction = activeCall.direction;
      }
    }

    if (comm.transcript) {
      return new Response(JSON.stringify({ ok: true, transcript: comm.transcript }), {
        headers: corsHeaders,
      });
    }

    if (!comm.recording_url) {
      return new Response(JSON.stringify({ error: 'No recording available for this call' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const audioBlob = await fetchTwilioRecordingAsBlob(comm.recording_url);
    const rawTranscript = await transcribeWithWhisper(audioBlob);
    
    // Add speaker labels using GPT
    const transcript = await addSpeakerLabels(rawTranscript, direction);

    const { error: updateErr } = await adminSupabase
      .from('communications')
      .update({ transcript })
      .eq('id', comm.id);

    if (updateErr) {
      throw updateErr;
    }

    return new Response(JSON.stringify({ ok: true, transcript }), { headers: corsHeaders });
  } catch (error) {
    console.error('retry-call-transcription error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
