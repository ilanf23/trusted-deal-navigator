import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

export async function persistProviderBoundaryLog(log: ProviderBoundaryLog) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Always insert a provider boundary event (best effort).
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

  // Keep existing app behavior (best effort): upsert active_calls so the UI can react.
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

  // Optional enrichment (best effort): match lead by phone.
  try {
    const normalizedPhone = (log.fromNumber || '').replace(/\D/g, '').slice(-10);
    if (normalizedPhone) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id, name')
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
    // Ignore enrichment failures.
    console.error('Lead enrichment failed:', err);
  }
}

export async function maybeAlertInboundRoutingBroken(log: ProviderBoundaryLog) {
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
