import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
  'Cache-Control': 'no-store',
};

function waitUntil(task: Promise<unknown>) {
  try {
    // @ts-expect-error - EdgeRuntime is a global in the edge runtime.
    const maybe = globalThis.EdgeRuntime?.waitUntil;
    if (typeof maybe === 'function') {
      // @ts-expect-error - runtime provided.
      globalThis.EdgeRuntime.waitUntil(task);
      return;
    }
  } catch {
    // ignore
  }
  task.catch((err) => console.error('waitUntil background task failed:', err));
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function parseCsvEnv(name: string): string[] {
  const raw = Deno.env.get(name);
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildInboundTwiML(opts: {
  holdMessage: string;
  dialTimeoutSeconds: number;
  statusCallbackUrl?: string;
  clientIdentities: string[];
}) {
  const identities = opts.clientIdentities.filter(Boolean);

  const clientStatusAttrs = opts.statusCallbackUrl
    ? ` statusCallback="${escapeXml(opts.statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed"`
    : '';

  const dialRecordingAttrs = opts.statusCallbackUrl
    ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(opts.statusCallbackUrl)}" recordingStatusCallbackEvent="completed"`
    : '';

  const dialTargets = identities.length
    ? identities
        .map(
          (identity) =>
            `    <Client${clientStatusAttrs}>\n      <Identity>${escapeXml(identity)}</Identity>\n    </Client>`
        )
        .join('\n')
    : '';

  const hold = escapeXml(opts.holdMessage);

  if (!dialTargets) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${hold}</Say>
  <Pause length="60" />
  <Say voice="alice">We are still trying to connect your call.</Say>
</Response>`;
  }

  // CRITICAL: Do NOT set <Dial action="..."> unless that endpoint returns TwiML.
  // Our call-status endpoint returns plain 'OK', so using action would cause Twilio to end the call.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${hold}</Say>
  <Dial timeout="${opts.dialTimeoutSeconds}" answerOnBridge="true"${dialRecordingAttrs}>
${dialTargets}
  </Dial>
  <Say voice="alice">We\'re sorry, no one is available to take your call right now. Please leave a message after the beep, or try again later.</Say>
  <Record maxLength="120" transcribe="false"${
    opts.statusCallbackUrl
      ? ` recordingStatusCallback="${escapeXml(opts.statusCallbackUrl)}"`
      : ''
  } />
  <Say voice="alice">Thank you for your message. Goodbye.</Say>
</Response>`;
}

function getSlackConfig() {
  const token = Deno.env.get('SLACK_BOT_TOKEN') || Deno.env.get('SLACK_API_KEY');
  const channel = Deno.env.get('SLACK_CHANNEL_ID');
  return { token, channel };
}

async function sendSlackAlert(text: string) {
  const { token, channel } = getSlackConfig();
  if (!token || !channel) return;

  const resp = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error('Slack alert failed:', resp.status, body);
  }
}

type ProviderBoundaryLog = {
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
};

async function persistProviderBoundaryLog(log: ProviderBoundaryLog) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from('call_events').insert({
    call_flow_id: log.callFlowId,
    call_sid: log.callSid || 'unknown',
    event_type: 'provider_boundary',
    from_number: log.fromNumber || null,
    to_number: log.toNumber || null,
    webhook_received: true,
    metadata: {
      provider_call_id: log.callSid,
      webhook_url: log.webhookUrl,
      http_status: log.httpStatus,
      response_time_ms: log.responseTimeMs,
      response_body: log.responseBody,
      webhook_timestamp: log.webhookTimestamp,
      raw_params: log.rawParams,
    },
  });

  await supabase
    .from('active_calls')
    .upsert(
      {
        call_sid: log.callSid,
        from_number: log.fromNumber,
        to_number: log.toNumber,
        status: 'ringing',
        direction: 'inbound',
        call_flow_id: log.callFlowId,
        webhook_timestamp: log.webhookTimestamp,
      },
      { onConflict: 'call_sid' }
    );

  // Best-effort lead enrichment (in background only)
  try {
    const normalizedPhone = (log.fromNumber || '').replace(/\D/g, '').slice(-10);
    if (normalizedPhone) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .or(`phone.ilike.%${normalizedPhone}%`)
        .limit(1)
        .single();

      if (lead?.id) {
        await supabase
          .from('active_calls')
          .update({ lead_id: lead.id })
          .eq('call_sid', log.callSid);
      }
    }
  } catch (err) {
    console.error('Lead enrichment failed:', err);
  }
}

async function maybeAlertInboundRoutingBroken(log: ProviderBoundaryLog) {
  if (log.httpStatus !== 200 || log.responseTimeMs > 1000 || !log.responseBody?.trim()) {
    await sendSlackAlert(
      `Inbound call routing broken\n` +
        `CallSid: ${log.callSid || 'unknown'}\n` +
        `URL: ${log.webhookUrl}\n` +
        `Status: ${log.httpStatus}\n` +
        `Latency: ${Math.round(log.responseTimeMs)}ms`
    );
  }
}

function generateFlowId(): string {
  return crypto.randomUUID();
}

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
