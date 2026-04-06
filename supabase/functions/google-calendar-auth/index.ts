import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'google-calendar-auth', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get the authorization header
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

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = claimsData.user.id;
    const { action, code, redirectUri, teamMemberName } = await req.json();

    if (action === 'getAuthUrl') {
      // Generate Google OAuth URL for Calendar access
      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'email',
        'profile'
      ].join(' ');

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', userId);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: corsHeaders }
      );
    }

    if (action === 'exchangeCode') {
      // Exchange authorization code for tokens
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
          { status: 400, headers: corsHeaders }
        );
      }

      // Get user email from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Calculate token expiry
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Use service role to upsert (since user might not have a row yet)
      const supabaseAdmin = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // If team member name is provided, use that as the key, otherwise use user_id
      const upsertData: Record<string, unknown> = {
        user_id: userId,
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokenExpiry,
        calendar_id: 'primary',
      };
      
      if (teamMemberName) {
        upsertData.team_member_name = teamMemberName;
      }

      const { error: upsertError } = await supabaseAdmin
        .from('calendar_connections')
        .upsert(upsertData, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Failed to save tokens:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save calendar connection' }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true, email: userInfo.email }),
        { headers: corsHeaders }
      );
    }

    if (action === 'disconnect') {
      const supabaseAdmin = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Delete by team member name if provided, otherwise by user_id
      let query = supabaseAdmin.from('calendar_connections').delete();
      if (teamMemberName) {
        query = query.eq('team_member_name', teamMemberName);
      } else {
        query = query.eq('user_id', userId);
      }
      
      const { error } = await query;

      if (error) {
        console.error('Failed to disconnect:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect calendar' }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: corsHeaders }
      );
    }

    if (action === 'getStatus') {
      const supabaseAdmin = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      // Query by team member name if provided, otherwise by user_id
      let query = supabaseAdmin
        .from('calendar_connections')
        .select('email, calendar_id, updated_at, team_member_name');
      
      if (teamMemberName) {
        query = query.eq('team_member_name', teamMemberName);
      } else {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ connected: true, email: data.email, calendarId: data.calendar_id }),
        { headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in google-calendar-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
