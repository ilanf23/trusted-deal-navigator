import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-connect-call', 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Auth verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role with diagnostic logging
    const { data: roleData, error: roleError } = await supabase
      .from('users')
      .select('app_role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError) {
      console.error('[twilio-connect-call] Error querying users table:', roleError.message);
      return new Response(JSON.stringify({ error: 'Failed to verify admin role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!roleData) {
      console.error('[twilio-connect-call] No users row found for user_id:', user.id, 'email:', user.email);
      return new Response(JSON.stringify({ error: 'Admin access required — no user record found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAdminRole = roleData.app_role === 'admin' || roleData.app_role === 'super_admin';
    if (!isAdminRole) {
      console.error('[twilio-connect-call] User', user.id, 'has role', roleData.app_role, '— admin required');
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { callSid } = await req.json();
    if (!callSid) {
      return new Response(JSON.stringify({ error: 'callSid is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    // Generate a unique conference room name for this call
    const conferenceName = `call-bridge-${callSid}`;

    // Build TwiML URL that places the caller into the conference room
    const twimlUrl = `${supabaseUrl}/functions/v1/twilio-conference?conference=${encodeURIComponent(conferenceName)}`;

    console.log(`[twilio-connect-call] Redirecting call ${callSid} into conference: ${conferenceName}`);

    // Use Twilio REST API to update the live call — redirect it into the conference
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
    const basicAuth = btoa(`${accountSid}:${authToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Url: twimlUrl,
        Method: 'POST',
      }).toString(),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('[twilio-connect-call] Twilio API error:', twilioResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to redirect call' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await twilioResponse.json();
    console.log('[twilio-connect-call] Call redirected to conference successfully:', result.sid);

    // Return the conference name so the frontend can join it
    return new Response(JSON.stringify({ 
      success: true, 
      callSid: result.sid,
      conferenceName: conferenceName,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[twilio-connect-call] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
