import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { errorResponse } from '../_shared/responses.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

/**
 * Authenticated audio proxy for Twilio recordings.
 *
 * Why this exists: Twilio recording URLs require HTTP Basic auth with the
 * account SID and auth token. We previously surfaced the raw .mp3 URL into
 * <audio src=...>, which (a) cannot play without credentials in the browser
 * and (b) would expose Twilio creds if we ever inlined them. This endpoint
 * gates playback on the calling Supabase user's session and streams the audio
 * back without leaking credentials.
 *
 * Accepts the communication row's id as `communicationId` (preferred) on
 * either a GET query string or POST body. The recording itself is resolved
 * server-side from communications.recording_url; the caller never sees the
 * Twilio URL.
 *
 * Currently any authenticated team member is allowed. The same restriction
 * could be tightened to lead-scoped access by joining lead_id against the
 * caller's accessible deals — that can be layered on without changing the
 * audio path semantics.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'call-recording-audio', 120, 60);
  if (rateLimitResponse) return rateLimitResponse;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const supabase = createClient(supabaseUrl, serviceKey);

  if (!accountSid || !authToken) {
    return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Authenticate the caller. We use Supabase auth (the project's bearer JWT)
  // rather than the legacy admin gate so any authenticated team member can
  // play back a recording they can already see in the UI.
  let authedUserId: string | null = null;
  try {
    const auth = await getUserFromRequest(req, supabase);
    authedUserId = auth.authUserId;
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Pull communicationId from query string (GET) or JSON body (POST).
  const url = new URL(req.url);
  let communicationId = url.searchParams.get('communicationId') ?? '';
  if (!communicationId && req.method === 'POST') {
    try {
      const body = await req.json();
      communicationId = body?.communicationId ?? '';
    } catch {
      // ignore — handled below
    }
  }

  if (!communicationId) {
    return new Response(JSON.stringify({ error: 'communicationId required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: comm, error: commErr } = await supabase
    .from('communications')
    .select('id, recording_url, communication_type')
    .eq('id', communicationId)
    .maybeSingle();

  if (commErr) {
    return errorResponse('call-recording-audio', commErr, { corsHeaders, clientMessage: 'Lookup failed' });
  }
  if (!comm || comm.communication_type !== 'call' || !comm.recording_url) {
    return new Response(JSON.stringify({ error: 'No recording available' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Normalize to the .mp3 endpoint (Twilio also serves .wav; mp3 is small
  // enough for browser playback and matches our stored convention).
  let recordingUrl = comm.recording_url;
  if (!recordingUrl.endsWith('.mp3') && !recordingUrl.endsWith('.wav')) {
    recordingUrl = `${recordingUrl}.mp3`;
  }

  const basicAuth = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
  const headers: Record<string, string> = { Authorization: basicAuth };
  // Forward Range so seek/scrub works on the <audio> element.
  const range = req.headers.get('Range');
  if (range) headers.Range = range;

  const twilioRes = await fetch(recordingUrl, { headers, redirect: 'follow' });

  if (!twilioRes.ok && twilioRes.status !== 206) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch recording', status: twilioRes.status }),
      {
        status: twilioRes.status === 404 ? 404 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // Stream the body straight through. Copy the headers that <audio> needs to
  // render a usable scrubber/duration; deliberately do NOT forward Twilio's
  // Authorization or any cookies. authedUserId is referenced to keep the
  // value used (and surface it in logs for auditability).
  console.log(
    `[call-recording-audio] streaming recording for communication=${communicationId} to user=${authedUserId}`,
  );
  const responseHeaders: Record<string, string> = { ...corsHeaders };
  const passthrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
    'cache-control',
  ];
  for (const h of passthrough) {
    const v = twilioRes.headers.get(h);
    if (v) responseHeaders[h] = v;
  }
  if (!responseHeaders['content-type']) responseHeaders['content-type'] = 'audio/mpeg';
  responseHeaders['cache-control'] = 'private, max-age=300';

  return new Response(twilioRes.body, {
    status: twilioRes.status,
    headers: responseHeaders,
  });
});
