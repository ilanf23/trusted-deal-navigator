import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { transcribeCommunication } from '../_shared/transcription.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

/**
 * Admin-only retry endpoint that re-runs the transcription pipeline for an
 * existing communication. Heavy lifting now lives in
 * `_shared/transcription.ts` so this function and the Twilio webhook share
 * one code path.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'retry-call-transcription', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const authResult = await requireAdmin(req, adminSupabase, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    const body = await req.json().catch(() => ({}));
    const communicationId = body?.communicationId as string | undefined;

    if (!communicationId) {
      return new Response(JSON.stringify({ error: 'Missing communicationId' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Pre-flight: confirm the row is a call before running the pipeline so
    // admins get a clean 400 instead of a generic "no recording" message.
    const { data: comm, error: commErr } = await adminSupabase
      .from('communications')
      .select('id, communication_type, recording_url, transcript')
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

    if (!comm.recording_url) {
      return new Response(JSON.stringify({ error: 'No recording available for this call' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Idempotent: if a transcript already exists, return it without burning
    // another Whisper call. Admin can still force regeneration by clearing
    // the column manually.
    if (comm.transcript) {
      return new Response(
        JSON.stringify({ ok: true, transcript: comm.transcript }),
        { headers: corsHeaders },
      );
    }

    const result = await transcribeCommunication(adminSupabase, communicationId, {
      skipIfPresent: true,
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, transcript: result.transcript }),
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('retry-call-transcription error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
