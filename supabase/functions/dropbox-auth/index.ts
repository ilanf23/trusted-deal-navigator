import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')!;
const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-auth', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse body first to determine action
    const body = await req.json();
    const { action, code, redirectUri, teamMemberName } = body;

    // Actions that don't require user auth (popup may not have session restored)
    const publicActions = ['exchangeCode', 'getStatus'];
    const isPublicAction = publicActions.includes(action);

    let userId: string | undefined;

    if (!isPublicAction) {
      // Require auth for connect, disconnect, getAuthUrl
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { status: 401, headers: corsHeaders }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
      if (claimsError || !claimsData.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: corsHeaders }
        );
      }
      userId = claimsData.user.id;
    } else {
      // For public actions, try to get userId from auth header if available (best effort)
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        try {
          const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
          });
          const token = authHeader.replace('Bearer ', '');
          const { data: claimsData } = await supabase.auth.getUser(token);
          if (claimsData?.user) {
            userId = claimsData.user.id;
          }
        } catch {
          // Ignore - userId stays undefined for public actions
        }
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (action === 'getAuthUrl') {
      const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
      authUrl.searchParams.set('client_id', DROPBOX_APP_KEY);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('token_access_type', 'offline');
      authUrl.searchParams.set('state', userId!);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: corsHeaders }
      );
    }

    if (action === 'exchangeCode') {
      // Exchange authorization code for tokens — no user auth needed
      const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DROPBOX_APP_KEY,
          client_secret: DROPBOX_APP_SECRET,
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
          { status: 400, headers: corsHeaders }
        );
      }

      // Get user account info from Dropbox
      const accountResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const account = await accountResponse.json();

      // Calculate token expiry
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Delete any existing connection (single shared row)
      await supabaseAdmin
        .from('dropbox_connections')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const { error: insertError } = await supabaseAdmin
        .from('dropbox_connections')
        .insert({
          user_id: userId || '00000000-0000-0000-0000-000000000000',
          connected_by: teamMemberName,
          email: account.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          account_id: account.account_id,
        });

      if (insertError) {
        console.error('Failed to save tokens:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save Dropbox connection' }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true, email: account.email }),
        { headers: corsHeaders }
      );
    }

    if (action === 'disconnect') {
      // Delete all rows (single shared connection)
      const { error } = await supabaseAdmin
        .from('dropbox_connections')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error('Failed to disconnect:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect Dropbox' }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: corsHeaders }
      );
    }

    if (action === 'getStatus') {
      const { data, error } = await supabaseAdmin
        .from('dropbox_connections')
        .select('email, connected_by, last_sync_at')
        .limit(1)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          connected: true,
          email: data.email,
          connectedBy: data.connected_by,
          lastSyncAt: data.last_sync_at,
        }),
        { headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in dropbox-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
