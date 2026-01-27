import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://gateway.lovable.dev/slack/api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY') || Deno.env.get('SLACK_BOT_TOKEN');
    if (!SLACK_API_KEY) {
      throw new Error('SLACK_API_KEY or SLACK_BOT_TOKEN is not configured');
    }
    
    console.log('Using Slack token starting with:', SLACK_API_KEY.substring(0, 10));

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

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
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
