import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function fetchTwilioRecordingAsBlob(url: string) {
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Missing Twilio credentials');
  }

  const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch recording (${res.status})`);
  }

  return await res.blob();
}

async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.mp3');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Whisper error (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  return json.text || '';
}

async function addSpeakerLabels(rawTranscript: string, direction: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  const isInbound = direction === 'inbound';
  const party1 = isInbound ? 'Caller' : 'Agent';
  const party2 = isInbound ? 'Agent' : 'Caller';

  const systemPrompt = `You are a transcript formatter. Given a raw phone call transcript, your job is to:
1. Identify which parts were spoken by each party
2. Format it as a clean dialogue with speaker labels

The call is ${isInbound ? 'an inbound call (customer called us)' : 'an outbound call (we called the customer)'}.
- "${party1}" is the person who initiated/received the call first
- "${party2}" is the other party

Rules:
- Use "${party1}:" and "${party2}:" as speaker labels
- Each speaker's turn should be on its own line
- Infer speakers based on context: greetings, questions vs answers, professional vs casual tone, who introduces themselves, etc.
- If unsure, make reasonable assumptions based on typical phone call patterns
- Keep the original words, just add speaker labels and line breaks
- Do NOT add any commentary, just return the formatted transcript`;

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
    console.error('GPT speaker labeling failed, returning raw transcript');
    return rawTranscript;
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content || rawTranscript;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
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
      .from('evan_communications')
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
      .from('evan_communications')
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
