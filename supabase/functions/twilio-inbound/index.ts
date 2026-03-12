import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
  'Cache-Control': 'no-store',
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Fire-and-forget: schedule background work that must not block the TwiML response. */
function waitUntil(promise: Promise<unknown>): void {
  promise.catch((err) => console.error('[waitUntil] uncaught:', err));
}

/** Escape special XML characters for safe embedding inside TwiML. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

/** Read a comma-separated environment variable into a trimmed string array. */
function parseCsvEnv(key: string): string[] {
  const raw = Deno.env.get(key) || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Generate a unique flow ID for correlating all events in a single call flow. */
function generateFlowId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// TwiML builder
// ---------------------------------------------------------------------------

interface InboundTwiMLOptions {
  dialTimeoutSeconds: number;
  statusCallbackUrl?: string;
  clientIdentities: string[];
  callerId?: string;
  fallbackNumber?: string;
}

/**
 * Build TwiML that dials all configured Twilio Client identities (and optionally
 * a fallback phone number) simultaneously. If no one answers within the timeout,
 * the caller is prompted to leave a voicemail.
 *
 * Key design decisions:
 * - NO <Reject> or <Hangup> anywhere — every path ends with voicemail or answered call.
 * - statusCallback is used for event tracking only (NOT action, which would replace the flow).
 * - Both <Client> and <Number> inside a single <Dial> = Twilio fork-dials them simultaneously.
 */
function buildInboundTwiML(opts: InboundTwiMLOptions): string {
  const { dialTimeoutSeconds, statusCallbackUrl, clientIdentities, callerId, fallbackNumber } = opts;

  const clientTags = clientIdentities
    .map((id) => `<Client>${escapeXml(id)}</Client>`)
    .join('');

  // If a fallback phone number is configured, include it so Twilio rings it
  // simultaneously with the browser client(s). This ensures the call rings even
  // if no browser client is registered.
  const numberTag = fallbackNumber
    ? `<Number>${escapeXml(fallbackNumber)}</Number>`
    : '';

  // statusCallback for event tracking — do NOT use action (would replace flow with
  // whatever twilio-call-status returns, causing hangup if it returns empty TwiML).
  const statusAttr = statusCallbackUrl
    ? ` statusCallback="${escapeXml(statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST" record="record-from-answer-dual"`
    : '';

  // callerId ensures the backup phone shows the company number, not a random Twilio number
  const callerIdAttr = callerId
    ? ` callerId="${escapeXml(callerId)}"`
    : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Dial timeout="${dialTimeoutSeconds}"${callerIdAttr}${statusAttr}>`,
    `    ${clientTags}`,
    numberTag ? `    ${numberTag}` : '',
    '  </Dial>',
    '  <Record maxLength="120" playBeep="true" />',
    '</Response>',
  ].filter(Boolean).join('\n');
}


// ---------------------------------------------------------------------------
// Logging types (no-op persistence — we just console.log)
// ---------------------------------------------------------------------------

interface RoutingDecision {
  clientIdentities: string[];
  fallbackNumber: string | null;
  dialTimeoutSeconds: number;
  hasFallback: boolean;
}

interface ProviderBoundaryLog {
  callFlowId: string;
  callSid: string;
  fromNumber: string;
  toNumber: string;
  webhookUrl: string;
  httpStatus: number;
  responseTimeMs: number;
  responseBody: string;
  webhookTimestamp: string;
  rawParams?: Record<string, string>;
  routingDecision: RoutingDecision;
}

async function persistProviderBoundaryLog(boundary: ProviderBoundaryLog): Promise<void> {
  // No dedicated logging table — boundary is already console.logged above
  // This function exists to prevent runtime ReferenceError
  void boundary;
}

// ---------------------------------------------------------------------------
// Inbound call handler:
// - always returns TwiML fast
// - all DB writes + alerts happen in background
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const startedAt = performance.now();
  const callFlowId = generateFlowId();
  const webhookTimestamp = new Date().toISOString();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit in background — don't block TwiML response for Twilio webhooks
  waitUntil(
    enforceRateLimit(req, 'twilio-inbound', 300, 60).then((resp) => {
      if (resp) console.warn('[twilio-inbound] Rate limit would have blocked:', resp.status);
    })
  );

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
  const fallbackNumber = Deno.env.get('TWILIO_FALLBACK_NUMBER') || '';
  const callerId = Deno.env.get('TWILIO_PHONE_NUMBER') || '';

  const resolvedClients = clientIdentities.length ? clientIdentities : ['clx-admin'];
  const dialTimeoutSeconds = 45;

  // CRITICAL: Prevent recursive loop — if the fallback number is the same as
  // the Twilio phone number (toNumber), dialing it creates a new inbound call
  // that triggers this function again, consuming concurrency and cancelling
  // the browser client leg before it can ring.
  const normalizePhone = (n: string) => n.replace(/\D/g, '').slice(-10);
  const safeFallback =
    fallbackNumber &&
    normalizePhone(fallbackNumber) !== normalizePhone(toNumber) &&
    normalizePhone(fallbackNumber) !== normalizePhone(callerId)
      ? fallbackNumber
      : '';

  const routingDecision: RoutingDecision = {
    clientIdentities: resolvedClients,
    fallbackNumber: safeFallback || null,
    dialTimeoutSeconds,
    hasFallback: !!safeFallback,
  };

  console.log(
    '[INBOUND_ROUTING]',
    JSON.stringify({
      call_sid: callSid,
      from: fromNumber,
      to: toNumber,
      routing: routingDecision,
    })
  );

  const twiml = buildInboundTwiML({
    dialTimeoutSeconds,
    statusCallbackUrl,
    clientIdentities: resolvedClients,
    callerId: callerId || undefined,
    fallbackNumber: safeFallback || undefined,
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
    routingDecision,
  };

  waitUntil(
    (async () => {
      try {
        await persistProviderBoundaryLog(boundary);
      } catch (err) {
        console.error('Failed to persist provider boundary log:', err);
      }
      // Insert into active_calls so the frontend can detect the inbound call via realtime
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseKey && callSid) {
          const sb = createClient(supabaseUrl, supabaseKey);

          // Try to match the caller to a lead by phone number
          let leadId: string | null = null;
          if (fromNumber) {
            const normalized = fromNumber.replace(/\D/g, '').slice(-10);
            const { data: phoneMatch } = await sb
              .from('lead_phones')
              .select('lead_id')
              .ilike('phone_number', `%${normalized}`)
              .limit(1)
              .maybeSingle();
            if (phoneMatch) {
              leadId = phoneMatch.lead_id;
            }
          }

          const { error: insertErr } = await sb.from('active_calls').insert({
            call_sid: callSid,
            from_number: fromNumber,
            to_number: toNumber,
            direction: 'inbound',
            status: 'ringing',
            lead_id: leadId,
            call_flow_id: callFlowId,
            webhook_timestamp: webhookTimestamp,
          });
          if (insertErr) {
            console.error('Failed to insert active_call:', insertErr);
          } else {
            console.log('Inserted active_call for inbound call:', callSid);
          }
        }
      } catch (err) {
        console.error('Failed to insert active_call:', err);
      }
    })()
  );

  return new Response(twiml, { status: httpStatus, headers: corsHeaders });
});
