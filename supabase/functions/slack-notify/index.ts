import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, "slack-notify", 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN') || Deno.env.get('SLACK_API_KEY');
    if (!SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN is not configured');
    }
    
    console.log('Using Slack token starting with:', SLACK_BOT_TOKEN.substring(0, 10));

    const SLACK_CHANNEL_ID = Deno.env.get('SLACK_CHANNEL_ID');
    if (!SLACK_CHANNEL_ID) {
      throw new Error('SLACK_CHANNEL_ID is not configured');
    }

    const { message, blocks } = await req.json();

    if (!message && !blocks) {
      throw new Error('Message or blocks is required');
    }

    console.log('Sending Slack message to channel:', SLACK_CHANNEL_ID);

    const payload: Record<string, unknown> = {
      channel: SLACK_CHANNEL_ID,
    };

    if (blocks) {
      payload.blocks = blocks;
      payload.text = message || 'New notification';
    } else {
      payload.text = message;
    }

    // Call Slack API directly
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      console.error('Slack API error:', data);
      throw new Error(`Slack API call failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    console.log('Slack message sent successfully:', data.ts);

    return new Response(JSON.stringify({ success: true, ts: data.ts }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error sending Slack message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
