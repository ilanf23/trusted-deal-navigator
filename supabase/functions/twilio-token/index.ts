import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ... keep existing code (base64UrlEncode, createTwilioAccessToken)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = enforceRateLimit(req, 'twilio-token', 5, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    const maskId = (v: string | null | undefined) =>
      v ? `${v.slice(0, 6)}…${v.slice(-4)}` : null;

    console.log('Twilio config check:', {
      hasAccountSid: !!accountSid,
      hasApiKeySid: !!apiKeySid,
      hasApiKeySecret: !!apiKeySecret,
      hasTwimlAppSid: !!twimlAppSid,
      accountSid: maskId(accountSid),
      apiKeySid: maskId(apiKeySid),
      twimlAppSid: maskId(twimlAppSid),
    });

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured. Required: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth header for JWT validation
    const supabaseAnon = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseAnon.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    
    // Create admin client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Restrict Twilio receiving to Evan only (privacy + routing correctness)
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('name')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!teamMember?.name || teamMember.name.toLowerCase() !== 'evan') {
      return new Response(
        JSON.stringify({ error: 'Evan access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use a single stable identity so inbound <Dial><Client> can always ring Evan.
    const identity = 'evan-admin';
    
    console.log('Creating access token for identity:', identity, 'with TwiML App:', twimlAppSid);
    
    const accessToken = await createTwilioAccessToken(
      accountSid,
      apiKeySid,
      apiKeySecret,
      identity,
      twimlAppSid
    );

    console.log('Generated Twilio access token for identity:', identity);

    return new Response(
      JSON.stringify({ 
        token: accessToken,
        identity: identity 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating Twilio token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
