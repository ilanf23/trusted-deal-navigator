import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RFC7519 JWT creation for Twilio Access Token (Voice SDK)
// Twilio expects a special `cty` header and base64url encoding.
function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function createTwilioAccessToken(
  accountSid: string,
  apiKey: string,
  apiSecret: string,
  identity: string,
  twimlAppSid: string
): Promise<string> {
  // Twilio AccessTokens typically include this content-type header
  const header = { alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' };
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const payload = {
    jti: `${apiKey}-${now}`,
    iss: apiKey,
    sub: accountSid,
    iat: now,
    exp: expiry,
    grants: {
      identity,
      voice: {
        outgoing: {
          application_sid: twimlAppSid,
        },
        incoming: {
          allow: true,
        },
      },
    },
  };

  const base64Header = base64UrlEncode(JSON.stringify(header));
  const base64Payload = base64UrlEncode(JSON.stringify(payload));

  const message = new TextEncoder().encode(`${base64Header}.${base64Payload}`);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  const base64Signature = base64UrlEncode(new Uint8Array(signature));

  return `${base64Header}.${base64Payload}.${base64Signature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Generate identity for this user
    const identity = `evan-${userId.substring(0, 8)}`;
    
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
