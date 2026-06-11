import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  createGoogleOAuthState,
  getGoogleCapabilities,
  getGoogleScopes,
  GOOGLE_INTEGRATIONS,
  hasGoogleIntegrationScopes,
  isGoogleIntegration,
  verifyGoogleOAuthState,
} from '../_shared/googleOAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'google-auth', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    const userId = authResult.auth.authUserId;
    const { action, code, redirectUri, integration, state } = await req.json();

    if (action === 'getAuthUrl') {
      const isLegacyRequest = integration === undefined;
      if (!isLegacyRequest && !isGoogleIntegration(integration)) {
        return new Response(
          JSON.stringify({ error: 'A valid Google integration is required' }),
          { status: 400, headers: jsonHeaders },
        );
      }
      const requestedIntegration = isGoogleIntegration(integration)
        ? integration
        : 'gmail';
      const requestedScopes = isLegacyRequest
        ? [...new Set(GOOGLE_INTEGRATIONS.flatMap(getGoogleScopes))]
        : getGoogleScopes(requestedIntegration);

      const oauthState = await createGoogleOAuthState(
        GOOGLE_CLIENT_SECRET,
        userId,
        requestedIntegration,
      );
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', requestedScopes.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('include_granted_scopes', 'true');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', oauthState);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: jsonHeaders },
      );
    }

    if (action === 'exchangeCode') {
      const oauthState = typeof state === 'string'
        ? await verifyGoogleOAuthState(GOOGLE_CLIENT_SECRET, state, userId)
        : null;
      if (!oauthState) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired OAuth state. Please reconnect.' }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        return new Response(
          JSON.stringify({ error: tokens.error_description || 'Failed to exchange code' }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      const { data: existingConnection } = await supabaseAdmin
        .from('google_connections')
        .select('refresh_token, scopes')
        .eq('user_id', userId)
        .maybeSingle();
      const refreshToken = tokens.refresh_token || existingConnection?.refresh_token;
      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: 'Google did not return a refresh token. Revoke access and reconnect.' }),
          { status: 400, headers: jsonHeaders },
        );
      }
      const grantedScopes = tokens.scope || getGoogleScopes(oauthState.integration).join(' ');

      const { error: upsertError } = await supabaseAdmin
        .from('google_connections')
        .upsert({
          user_id: userId,
          email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: refreshToken,
          token_expiry: tokenExpiry,
          scopes: grantedScopes,
          calendar_id: 'primary',
          needs_reauth: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Failed to save tokens:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save Google connection' }),
          { status: 500, headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          email: userInfo.email,
          integration: oauthState.integration,
          capabilities: getGoogleCapabilities(grantedScopes),
        }),
        { headers: jsonHeaders },
      );
    }

    if (action === 'getStatus') {
      const isLegacyRequest = integration === undefined;
      if (!isLegacyRequest && !isGoogleIntegration(integration)) {
        return new Response(
          JSON.stringify({ error: 'A valid Google integration is required' }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const { data } = await supabaseAdmin
        .from('google_connections')
        .select('email, calendar_id, needs_reauth, scopes, created_at')
        .eq('user_id', userId)
        .maybeSingle();

      const connected = !!data &&
        !data.needs_reauth &&
        (isLegacyRequest || hasGoogleIntegrationScopes(data.scopes, integration));
      if (!connected) {
        return new Response(
          JSON.stringify({
            connected: false,
            needsReauth: data?.needs_reauth ?? false,
            capabilities: getGoogleCapabilities(data?.scopes),
          }),
          { headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({
          connected: true,
          email: data.email,
          calendarId: data.calendar_id,
          connectedAt: data.created_at,
          needsReauth: false,
          capabilities: getGoogleCapabilities(data.scopes),
        }),
        { headers: jsonHeaders },
      );
    }

    if (action === 'disconnect') {
      const { error } = await supabaseAdmin
        .from('google_connections')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to disconnect:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect' }),
          { status: 500, headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: jsonHeaders },
    );
  } catch (error) {
    console.error('Error in google-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
