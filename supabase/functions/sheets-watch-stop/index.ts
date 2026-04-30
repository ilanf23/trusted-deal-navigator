// Stops an active Google Drive file-change watch.
// Called when the SheetEditor unmounts.

import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getValidSheetsAccessToken } from '../_shared/googleTokenRefresh.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimited = await enforceRateLimit(req, 'sheets-watch-stop', 30, 60);
  if (rateLimited) return rateLimited;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claims.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.user.id;

    const { teamMemberName } = await req.json().catch(() => ({}));

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let q = admin.from('sheets_connections').select('*').eq('user_id', userId);
    if (teamMemberName) q = q.eq('user_name', teamMemberName);
    const { data: connection } = await q.maybeSingle();

    if (!connection || !connection.drive_watch_channel_id || !connection.drive_watch_resource_id) {
      return new Response(JSON.stringify({ stopped: false, reason: 'no active watch' }), { status: 200, headers: corsHeaders });
    }

    const accessToken = await getValidSheetsAccessToken(connection, admin);
    if (accessToken) {
      const res = await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: connection.drive_watch_channel_id,
          resourceId: connection.drive_watch_resource_id,
        }),
      });
      if (!res.ok) {
        // Non-fatal: still clear our local record so we don't leak channel state.
        console.warn('Drive channels.stop non-OK:', res.status, await res.text());
      }
    }

    await admin
      .from('sheets_connections')
      .update({
        drive_watch_channel_id: null,
        drive_watch_channel_token: null,
        drive_watch_resource_id: null,
        drive_watch_expiry: null,
        drive_watch_spreadsheet_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return new Response(JSON.stringify({ stopped: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('sheets-watch-stop error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
