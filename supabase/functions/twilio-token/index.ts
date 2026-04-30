import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createTwilioAccessToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  identity: string,
  twimlAppSid: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    typ: 'JWT',
    alg: 'HS256',
    cty: 'twilio-fpa;v=1',
  };

  const voiceGrant: Record<string, unknown> = {
    outgoing: { application_sid: twimlAppSid },
    incoming: { allow: true },
  };

  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    nbf: now,
    exp: expiry,
    grants: {
      identity: identity,
      voice: voiceGrant,
    },
  };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKeySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${signingInput}.${encodedSignature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-token', 5, 60);
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await requireAdmin(req, supabase, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    const { auth } = authResult;
    const userId = auth.authUserId;
    const teamMemberId = auth.teamMember!.id;
    console.log('[twilio-token] Authenticated user:', userId, 'email:', auth.authUserEmail);

    // Fetch fields needed beyond the role gate.
    const { data: extraData, error: extraError } = await supabase
      .from('users')
      .select('is_active, twilio_phone_number')
      .eq('id', teamMemberId)
      .maybeSingle();

    if (extraError) {
      console.error('[twilio-token] Error querying users table:', extraError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extraData?.is_active) {
      console.warn('[twilio-token] User', userId, 'is inactive but has admin role — allowing access');
    }

    if (!extraData?.twilio_phone_number) {
      console.log('[twilio-token] User', userId, 'has no twilio_phone_number — calling not configured');
      return new Response(
        JSON.stringify({ error: 'Calling not configured for this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Per-user Twilio Client identity. Must match the <Client> identity dialed by twilio-inbound,
    // which is built from users.id (public.users primary key) of the row owning the dialed To number.
    const identity = `clx-admin-${teamMemberId}`;
    
    console.log('[twilio-token] Authorized admin user:', userId, 'identity:', identity);
    
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
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});