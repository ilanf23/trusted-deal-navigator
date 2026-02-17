import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// ... keep existing code (fetchTwilioRecordingAsBlob, transcribeWithWhisper, addSpeakerLabels)

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
