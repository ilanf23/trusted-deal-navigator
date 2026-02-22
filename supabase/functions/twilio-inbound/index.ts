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
    '  <Say voice="alice">Sorry, no one is available to take your call right now. Please leave a message after the beep and we will call you back as soon as possible.</Say>',
    '  <Record maxLength="120" transcribe="true" playBeep="true" />',
    '  <Say voice="alice">Thank you for your message. Goodbye.</Say>',
    '</Response>',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Slack alerting
// ---------------------------------------------------------------------------

interface SlackConfig {
  token: string;
  channel: string;
}

function getSlackConfig(): SlackConfig | null {
  const token = Deno.env.get('SLACK_BOT_TOKEN') || Deno.env.get('SLACK_API_KEY') || '';
  const channel = Deno.env.get('SLACK_CHANNEL_ID') || '';
  if (!token || !channel) return null;
  return { token, channel };
}

async function sendSlackAlert(config: SlackConfig, message: string): Promise<void> {
  try {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: config.channel, text: message }),
    });
    if (!resp.ok) {
      console.error('Slack alert failed:', resp.status, await resp.text());
    }
  } catch (err) {
    console.error('Slack alert error:', err);
  }
}

// ---------------------------------------------------------------------------
// Provider boundary logging
// ---------------------------------------------------------------------------

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
  routingDecision?: RoutingDecision;
}

interface RoutingDecision {
  clientIdentities: string[];
  fallbackNumber: string | null;
  dialTimeoutSeconds: number;
  hasFallback: boolean;
}

async function persistProviderBoundaryLog(log: ProviderBoundaryLog): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from('call_events').insert({
    call_flow_id: log.callFlowId,
    call_sid: log.callSid,
    event_type: 'provider_boundary_inbound',
    from_number: log.fromNumber,
    to_number: log.toNumber,
    metadata: {
      webhook_url: log.webhookUrl,
      http_status: log.httpStatus,
      response_time_ms: Math.round(log.responseTimeMs),
      response_body: log.responseBody,
      raw_params: log.rawParams,
      routing_decision: log.routingDecision,
    },
  });
}

async function maybeAlertInboundRoutingBroken(log: ProviderBoundaryLog): Promise<void> {
  // Alert if the response body is empty or doesn't contain a <Dial> tag
  if (log.responseBody && log.responseBody.includes('<Dial')) return;

  const slack = getSlackConfig();
  if (!slack) return;

  await sendSlackAlert(
    slack,
    `🚨 *Inbound routing may be broken!*\n` +
      `CallSid: ${log.callSid}\nFrom: ${log.fromNumber}\nTo: ${log.toNumber}\n` +
      `HTTP ${log.httpStatus} in ${Math.round(log.responseTimeMs)}ms\n` +
      `Response body does not contain <Dial>:\n\`\`\`${log.responseBody.slice(0, 500)}\`\`\``
  );
}

async function maybeAlertVoicemail(log: ProviderBoundaryLog): Promise<void> {
  // This is a preemptive alert — we know that if no one answers, the caller gets
  // voicemail. The actual voicemail detection happens via statusCallback events,
  // but we alert here if there's no fallback number configured (higher risk of missed calls).
  if (log.routingDecision?.hasFallback) return;

  const slack = getSlackConfig();
  if (!slack) return;

  await sendSlackAlert(
    slack,
    `📞 *Inbound call with NO fallback number configured*\n` +
      `CallSid: ${log.callSid}\nFrom: ${log.fromNumber}\nTo: ${log.toNumber}\n` +
      `If browser client is offline, this call will go to voicemail.\n` +
      `Consider setting TWILIO_FALLBACK_NUMBER for backup routing.`
  );
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
  const fallbackNumber = Deno.env.get('TWILIO_FALLBACK_NUMBER') || '';
  const callerId = Deno.env.get('TWILIO_PHONE_NUMBER') || '';

  const resolvedClients = clientIdentities.length ? clientIdentities : ['evan-admin'];
  const dialTimeoutSeconds = 45;

  const routingDecision: RoutingDecision = {
    clientIdentities: resolvedClients,
    fallbackNumber: fallbackNumber || null,
    dialTimeoutSeconds,
    hasFallback: !!fallbackNumber,
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
    fallbackNumber: fallbackNumber || undefined,
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
      try {
        await maybeAlertInboundRoutingBroken(boundary);
      } catch (err) {
        console.error('Failed to send inbound monitoring alert:', err);
      }
      try {
        await maybeAlertVoicemail(boundary);
      } catch (err) {
        console.error('Failed to send voicemail risk alert:', err);
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
