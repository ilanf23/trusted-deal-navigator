import { buildInboundTwiML } from './twiml.ts';
import { waitUntil } from './waitUntil.ts';
import { maybeAlertInboundRoutingBroken, persistProviderBoundaryLog } from './boundaryLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
  'Cache-Control': 'no-store',
};

function generateFlowId(): string {
  return crypto.randomUUID();
}

function parseCsvEnv(name: string): string[] {
  const raw = Deno.env.get(name);
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// This endpoint handles incoming calls from Twilio.
// Reliability requirements:
// - Respond fast (< 1s)
// - Always return valid TwiML
// - Never depend on DB or external calls BEFORE responding
Deno.serve(async (req) => {
  const startedAt = performance.now();
  const callFlowId = generateFlowId();
  const webhookTimestamp = new Date().toISOString();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse Twilio params (best effort). Even if parsing fails, we still return TwiML.
  let callSid = '';
  let fromNumber = '';
  let toNumber = '';
  let rawParams: Record<string, string> | undefined;

  try {
    const formData = await req.formData().catch(() => null);
    callSid = formData?.get('CallSid')?.toString() || '';
    fromNumber = formData?.get('From')?.toString() || '';
    toNumber = formData?.get('To')?.toString() || '';
    rawParams = formData ? Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])) : undefined;
  } catch {
    // ignore
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const statusCallbackUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/twilio-call-status` : undefined;

  // Static dial targets (no DB lookup): configurable via env.
  const clientIdentities = parseCsvEnv('TWILIO_INBOUND_CLIENT_IDENTITIES');
  const twiml = buildInboundTwiML({
    holdMessage: 'Please hold while we connect your call.',
    dialTimeoutSeconds: 30,
    statusCallbackUrl,
    clientIdentities: clientIdentities.length ? clientIdentities : ['evan-admin'],
  });

  const responseTimeMs = performance.now() - startedAt;
  const httpStatus = 200;

  // Provider boundary logging (console ALWAYS, DB + monitoring best-effort in background)
  const boundary = {
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

  // Single-line log for easy auditing/proof.
  console.log('[INBOUND_BOUNDARY]', JSON.stringify({
    provider_call_id: callSid,
    webhook_url: req.url,
    http_status: httpStatus,
    response_time_ms: Math.round(responseTimeMs),
    response_body: twiml,
  }));

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
