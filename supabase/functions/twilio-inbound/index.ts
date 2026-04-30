import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { verifyTwilioSignature } from '../_shared/twilioSignature.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  // Verify the Twilio signature BEFORE doing any DB work. HMAC-SHA1 is sub-millisecond
  // and rejects unauthenticated POSTs that would otherwise trigger active_calls inserts
  // and lookups (see issue #78). The helper consumes the request body and hands back a
  // URLSearchParams — do NOT call req.formData() afterward, the body is gone.
  const verified = await verifyTwilioSignature(req, corsHeaders);
  if (!verified.ok) return verified.response;
  const params = verified.params;

  // Synchronous rate limit. A valid Twilio signature is itself a throttle, but this
  // is a defense-in-depth bound on per-IP request rate.
  const rateLimited = await enforceRateLimit(req, 'twilio-inbound', 300, 60);
  if (rateLimited) return rateLimited;

  const callSid = params.get('CallSid') ?? '';
  const fromNumber = params.get('From') ?? '';
  const toNumber = params.get('To') ?? '';
  const rawParams: Record<string, string> = Object.fromEntries(params.entries());

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const statusCallbackUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/twilio-call-status` : undefined;
  const fallbackNumber = Deno.env.get('TWILIO_FALLBACK_NUMBER') || '';
  const callerId = Deno.env.get('TWILIO_PHONE_NUMBER') || '';

  // Resolve the Twilio Client identity by looking up which user owns the dialed
  // Twilio number. Each calling-enabled user has a unique identity (clx-admin-<userId>),
  // so an inbound call only rings the browser of the rep whose number was dialed.
  // If the lookup fails or no row matches, dial no client — fallback number / voicemail
  // still cover the call.
  let resolvedClients: string[] = [];
  if (supabaseUrl && supabaseServiceKey && toNumber) {
    try {
      const sbLookup = createClient(supabaseUrl, supabaseServiceKey);
      const normalizedTo = toNumber.replace(/\D/g, '').slice(-10);
      const { data: ownerRows, error: ownerErr } = await sbLookup
        .from('users')
        .select('id, twilio_phone_number')
        .not('twilio_phone_number', 'is', null);
      if (ownerErr) {
        console.error('[twilio-inbound] users lookup error:', ownerErr.message);
      } else if (ownerRows) {
        const owner = ownerRows.find(
          (row) => (row.twilio_phone_number ?? '').replace(/\D/g, '').slice(-10) === normalizedTo
        );
        if (owner) {
          resolvedClients = [`clx-admin-${owner.id}`];
        } else {
          console.warn('[twilio-inbound] no user owns dialed number:', toNumber);
        }
      }
    } catch (err) {
      console.error('[twilio-inbound] users lookup threw:', err);
    }
  }

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

  // Synchronously create the communications row keyed on call_sid before
  // returning TwiML. Post-call webhooks (twilio-call-status recording action,
  // twilio-transcription) look up by call_sid; without this the row would not
  // exist until end-of-call and those handlers would fall back to fuzzy
  // matching against unrelated calls. See issue #80.
  //
  // Failure here is non-fatal — TwiML still returns so the call connects.
  // Reuses the supabaseUrl/supabaseServiceKey already pulled earlier in this handler.
  let resolvedLeadId: string | null = null;
  const sb = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  if (sb && callSid) {
    try {
      if (fromNumber) {
        const normalized = fromNumber.replace(/\D/g, '').slice(-10);
        const { data: phoneMatch } = await sb
          .from('entity_phones')
          .select('entity_id')
          .ilike('phone_number', `%${normalized}`)
          .limit(1)
          .maybeSingle();
        if (phoneMatch) {
          resolvedLeadId = phoneMatch.entity_id;
        }
      }

      // Idempotent: Twilio retries on TwiML 5xx become no-ops via the partial
      // unique index on communications.call_sid.
      const { error: commErr } = await sb
        .from('communications')
        .upsert(
          {
            call_sid: callSid,
            communication_type: 'call',
            direction: 'inbound',
            phone_number: fromNumber,
            status: 'ringing',
            lead_id: resolvedLeadId,
            content: 'Incoming call - ringing',
          },
          { onConflict: 'call_sid', ignoreDuplicates: true },
        );
      if (commErr) {
        console.error('[twilio-inbound] communications upsert failed (non-fatal):', commErr);
      }
    } catch (err) {
      console.error('[twilio-inbound] communications upsert threw (non-fatal):', err);
    }
  }

  waitUntil(
    (async () => {
      try {
        await persistProviderBoundaryLog(boundary);
      } catch (err) {
        console.error('Failed to persist provider boundary log:', err);
      }
      // Insert into active_calls so the frontend can detect the inbound call via realtime.
      // active_calls is realtime-UI plumbing; brief lag is tolerable, so this stays async.
      if (sb && callSid) {
        try {
          const { error: insertErr } = await sb.from('active_calls').insert({
            call_sid: callSid,
            from_number: fromNumber,
            to_number: toNumber,
            direction: 'inbound',
            status: 'ringing',
            lead_id: resolvedLeadId,
            call_flow_id: callFlowId,
            webhook_timestamp: webhookTimestamp,
          });
          if (insertErr) {
            console.error('Failed to insert active_call:', insertErr);
          } else {
            console.log('Inserted active_call for inbound call:', callSid);
          }
        } catch (err) {
          console.error('Failed to insert active_call:', err);
        }
      }
    })()
  );

  return new Response(twiml, { status: httpStatus, headers: corsHeaders });
});
