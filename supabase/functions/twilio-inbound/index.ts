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
  recordingStatusCallbackUrl?: string;
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
  const {
    dialTimeoutSeconds,
    statusCallbackUrl,
    recordingStatusCallbackUrl,
    clientIdentities,
    callerId,
    fallbackNumber,
  } = opts;

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
    ? ` statusCallback="${escapeXml(statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST"`
    : '';

  // recordingStatusCallback ensures the same endpoint that handles call status
  // also receives "Recording=completed" with RecordingUrl/RecordingSid. Without
  // this, Twilio creates the recording but never POSTs a completion event, so
  // communications.recording_url stays NULL and transcription is never queued.
  const recordingAttrs = recordingStatusCallbackUrl
    ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingStatusCallbackUrl)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : ' record="record-from-answer-dual"';

  // callerId ensures the backup phone shows the company number, not a random Twilio number
  const callerIdAttr = callerId
    ? ` callerId="${escapeXml(callerId)}"`
    : '';

  // Voicemail <Record>: also wire its completion callback to twilio-call-status
  // so voicemail audio (and any future transcript) lands in communications via
  // the same path. transcribeCallback would also work for the legacy Twilio
  // transcription, but we standardize on Whisper through the call-status handler.
  const recordCallbackAttr = recordingStatusCallbackUrl
    ? ` recordingStatusCallback="${escapeXml(recordingStatusCallbackUrl)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : '';

  // Voicemail prompt — replaces a silent <Record> so callers always know what to do.
  // Critical when <Dial> has no targets (lookup miss + no fallback): without this,
  // Twilio plays its generic "we are unable to connect" voice and falls into a
  // silent Record verb, which is what callers report as "nothing happens".
  const voicemailLines = [
    '  <Say voice="alice">Thanks for calling. Please leave a message after the beep, and we\'ll get back to you shortly.</Say>',
    `  <Record maxLength="120" playBeep="true"${recordCallbackAttr} />`,
  ];

  // No targets — skip the empty <Dial> entirely and go straight to voicemail.
  // An empty <Dial> triggers Twilio's default "we are unable to connect" voice
  // before any subsequent verbs play, producing the caller-reported failure mode.
  if (!clientTags && !numberTag) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      ...voicemailLines,
      '</Response>',
    ].join('\n');
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Dial timeout="${dialTimeoutSeconds}"${callerIdAttr}${statusAttr}${recordingAttrs}>`,
    `    ${clientTags}`,
    numberTag ? `    ${numberTag}` : '',
    '  </Dial>',
    ...voicemailLines,
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
  let resolvedOwnerId: string | null = null;
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
          resolvedOwnerId = owner.id;
        } else {
          // Loud: the dialed DID is not registered to any user. Caller will get
          // voicemail (or the fallback number if configured). Fix by setting
          // users.twilio_phone_number for the rep who owns this DID.
          console.error(
            '[twilio-inbound] CRITICAL: no user owns dialed DID — voicemail will play. Check users.twilio_phone_number.',
            { dialed_to: toNumber, normalized: normalizedTo, owner_count: ownerRows.length },
          );
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
    recordingStatusCallbackUrl: statusCallbackUrl,
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
        // Two-pass caller lookup:
        //   1. entity_phones — polymorphic, multi-number table. Preferred
        //      because a contact can have several numbers (mobile/work/home).
        //      entity_id now points at the canonical entities table, so we
        //      embed entities and read source_id (the actual people.id).
        //   2. people.phone — direct column fallback, for contacts created
        //      from the People UI without an entity_phones row. people is the
        //      source of truth for caller identity per product spec, so a
        //      direct match still resolves to a "real" caller.
        // First match wins; we don't need to disambiguate.
        const { data: phoneMatch } = await sb
          .from('entity_phones')
          .select('entity_id, entities!inner(kind, source_id)')
          .ilike('phone_number', `%${normalized}`)
          .eq('entity_type', 'people')
          .limit(1)
          .maybeSingle();
        // With !inner the embed types as an object, but handle array shape
        // defensively in case the client returns one.
        const matchedEntity = Array.isArray(phoneMatch?.entities)
          ? phoneMatch?.entities[0]
          : phoneMatch?.entities;
        if (matchedEntity?.source_id) {
          resolvedLeadId = matchedEntity.source_id;
        } else {
          const { data: peopleMatch } = await sb
            .from('people')
            .select('id')
            .ilike('phone', `%${normalized}`)
            .limit(1)
            .maybeSingle();
          if (peopleMatch) {
            resolvedLeadId = peopleMatch.id;
          }
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
            user_id: resolvedOwnerId,
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
            user_id: resolvedOwnerId,
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
