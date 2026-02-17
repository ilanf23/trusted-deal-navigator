import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
  'Cache-Control': 'no-store',
};

// ... keep existing code (waitUntil, escapeXml, parseCsvEnv, buildInboundTwiML, getSlackConfig, sendSlackAlert, ProviderBoundaryLog, persistProviderBoundaryLog, maybeAlertInboundRoutingBroken, generateFlowId)

// Inbound call handler:
// - always returns TwiML fast
// - all DB writes + alerts happen in background
Deno.serve(async (req) => {
  const startedAt = performance.now();
  const callFlowId = generateFlowId();
  const webhookTimestamp = new Date().toISOString();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-inbound', 300, 60);
  if (rateLimitResponse) return rateLimitResponse;

  let callSid = '';
  let fromNumber = '';
  let toNumber = '';
  let rawParams: Record<string, string> | undefined;

  try {
    const formData = await req.formData().catch(() => null);
    callSid = formData?.get('CallSid')?.toString() || '';
    fromNumber = formData?.get('From')?.toString() || '';
    toNumber = formData?.get('To')?.toString() || '';
    rawParams = formData
      ? Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]))
      : undefined;
  } catch {
    // ignore
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const statusCallbackUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/twilio-call-status` : undefined;
  const clientIdentities = parseCsvEnv('TWILIO_INBOUND_CLIENT_IDENTITIES');

  const twiml = buildInboundTwiML({
    holdMessage: 'Please hold while we connect your call.',
    dialTimeoutSeconds: 30,
    statusCallbackUrl,
    clientIdentities: clientIdentities.length ? clientIdentities : ['evan-admin'],
  });

  const responseTimeMs = performance.now() - startedAt;
  const httpStatus = 200;

  console.log(
    '[INBOUND_BOUNDARY]',
    JSON.stringify({
      provider_call_id: callSid,
      webhook_url: req.url,
      http_status: httpStatus,
      response_time_ms: Math.round(responseTimeMs),
      response_body: twiml,
    })
  );

  const boundary: ProviderBoundaryLog = {
    callFlowId,
    callSid,
    fromNumber,
    toNumber,
    webhookUrl: req.url,
    httpStatus,
    responseTimeMs,
    responseBody: twiml,
    webhookTimestamp,
    rawParams,
  };

  waitUntil(
    (async () => {
      try {
        await persistProviderBoundaryLog(boundary);
      } catch (err) {
        console.error('Failed to persist provider boundary log:', err);
      }
      try {
        await maybeAlertInboundRoutingBroken(boundary);
      } catch (err) {
        console.error('Failed to send inbound monitoring alert:', err);
      }
    })()
  );

  return new Response(twiml, { status: httpStatus, headers: corsHeaders });
});
