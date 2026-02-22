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
  holdMessage: string;
  dialTimeoutSeconds: number;
  statusCallbackUrl?: string;
  clientIdentities: string[];
}

/**
 * Build TwiML that plays a hold message, then dials all configured
 * Twilio Client identities with optional status callbacks.
 */
function buildInboundTwiML(opts: InboundTwiMLOptions): string {
  const { holdMessage, dialTimeoutSeconds, statusCallbackUrl, clientIdentities } = opts;

  const clientTags = clientIdentities
    .map((id) => `<Client>${escapeXml(id)}</Client>`)
    .join('');

  const statusAttr = statusCallbackUrl
    ? ` action="${escapeXml(statusCallbackUrl)}" statusCallback="${escapeXml(statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST" record="record-from-answer-dual"`
    : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Say>${escapeXml(holdMessage)}</Say>`,
    `  <Dial timeout="${dialTimeoutSeconds}"${statusAttr}>`,
    `    ${clientTags}`,
    '  </Dial>',
    '</Response>',
  ].join('\n');
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
