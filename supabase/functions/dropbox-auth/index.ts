import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')!;
const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')!;

// Simple UUID v4 format check
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const REQUIRED_SCOPES = [
  'files.metadata.read',
  'files.metadata.write',
  'files.content.read',
  'files.content.write',
];

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

    const body = await req.json();
    const { action, code, redirectUri, teamMemberName, stateUserId } = body;

    // Only exchangeCode is public (popup may not have session).
    // All other actions require authentication.
    const isPublicAction = action === 'exchangeCode';

    let userId: string | undefined;

    if (!isPublicAction) {
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
      // For exchangeCode: try auth header first, fall back to stateUserId
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
          // Auth failed in popup — expected, fall through to stateUserId
        }
      }

      // Fall back to the OAuth state parameter (contains userId set during getAuthUrl)
      if (!userId && stateUserId && isValidUUID(stateUserId)) {
        userId = stateUserId;
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
      authUrl.searchParams.set('scope', REQUIRED_SCOPES.join(' '));

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: corsHeaders }
      );
    }

    if (action === 'exchangeCode') {
      // Validate we have a real user_id before attempting DB insert
      if (!userId || !isValidUUID(userId)) {
        console.error('exchangeCode: No valid user_id resolved. Auth header failed and no stateUserId provided.');
        return new Response(
          JSON.stringify({ error: 'Unable to identify user. Please try connecting again.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Exchange authorization code for tokens
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

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error('Token exchange HTTP error:', tokenResponse.status, errText);
        return new Response(
          JSON.stringify({ error: 'Failed to exchange authorization code with Dropbox' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        return new Response(
          JSON.stringify({ error: tokens.error_description || 'Failed to exchange code' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const grantedScopes = typeof tokens.scope === 'string'
        ? tokens.scope.split(' ').filter(Boolean)
        : [];

      if (grantedScopes.length > 0) {
        const missingScopes = REQUIRED_SCOPES.filter((scope) => !grantedScopes.includes(scope));
        if (missingScopes.length > 0) {
          return new Response(
            JSON.stringify({
              error: `Dropbox app is missing required scopes: ${missingScopes.join(', ')}. Update app permissions and reconnect.`,
            }),
            { status: 400, headers: corsHeaders }
          );
        }
      }

      // Get user account info from Dropbox
      let accountEmail: string | null = null;
      let accountId: string | null = null;

      try {
        const accountResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: null,
        });

        if (accountResponse.ok) {
          const account = await accountResponse.json();
          accountEmail = account.email || null;
          accountId = account.account_id || null;
        } else {
          console.error('Dropbox get_current_account failed:', accountResponse.status, await accountResponse.text());
        }
      } catch (acctErr) {
        console.error('Exception fetching Dropbox account info:', acctErr);
      }

      // Fallback: resolve email from the authenticated Supabase user
      if (!accountEmail) {
        const { data: userLookup } = await supabaseAdmin.auth.admin.getUserById(userId);
        accountEmail = userLookup?.user?.email || `user-${userId.substring(0, 8)}@dropbox-connected`;
        console.log('Used fallback email for Dropbox connection:', accountEmail);
      }

      // Calculate token expiry
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Delete only the current user's existing connection (per-user model)
      await supabaseAdmin
        .from('dropbox_connections')
        .delete()
        .eq('user_id', userId);

      const { error: insertError } = await supabaseAdmin
        .from('dropbox_connections')
        .insert({
          user_id: userId,
          connected_by: teamMemberName,
          email: accountEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          account_id: accountId,
        });

      if (insertError) {
        console.error('Failed to save tokens:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save Dropbox connection' }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true, email: accountEmail }),
        { headers: corsHeaders }
      );
    }

    if (action === 'disconnect') {
      const { error } = await supabaseAdmin
        .from('dropbox_connections')
        .delete()
        .eq('user_id', userId);

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
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch Dropbox connection status:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch Dropbox status' }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (!data) {
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
