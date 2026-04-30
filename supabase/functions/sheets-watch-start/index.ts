// Registers a Google Drive file-change watch for a spreadsheet.
// Called when the SheetEditor mounts. Stores channel metadata in sheets_connections.

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

  const rateLimited = await enforceRateLimit(req, 'sheets-watch-start', 30, 60);
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

    const { spreadsheetId, teamMemberName } = await req.json();
    if (!spreadsheetId) {
      return new Response(JSON.stringify({ error: 'spreadsheetId required' }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let q = admin.from('sheets_connections').select('*').eq('user_id', userId);
    if (teamMemberName) q = q.eq('user_name', teamMemberName);
    const { data: connection, error: connErr } = await q.maybeSingle();

    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: 'No Sheets connection for user' }), { status: 404, headers: corsHeaders });
    }

    const accessToken = await getValidSheetsAccessToken(connection, admin);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Could not refresh Google token' }), { status: 401, headers: corsHeaders });
    }

    // Channel ID must be unique per watch. Use a fresh UUID.
    const channelId = crypto.randomUUID();
    // Per-channel secret. Google echoes it in x-goog-channel-token on every notification;
    // sheets-watch-webhook compares it constant-time before accepting the change event.
    const channelToken = crypto.randomUUID();
    // Google default is 7d; we request 6d 23h to leave renewal headroom.
    const expirationMs = Date.now() + (6 * 24 + 23) * 60 * 60 * 1000;
    const webhookUrl = `${supabaseUrl}/functions/v1/sheets-watch-webhook`;

    const watchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/watch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: channelToken,
          expiration: String(expirationMs),
        }),
      },
    );

    if (!watchRes.ok) {
      const text = await watchRes.text();
      console.error('Drive watch failed:', text);
      return new Response(JSON.stringify({ error: 'Drive watch failed', detail: text }), { status: 502, headers: corsHeaders });
    }

    const watch = await watchRes.json();
    const expiration = watch.expiration ? new Date(Number(watch.expiration)).toISOString() : new Date(expirationMs).toISOString();

    await admin
      .from('sheets_connections')
      .update({
        drive_watch_channel_id: channelId,
        drive_watch_channel_token: channelToken,
        drive_watch_resource_id: watch.resourceId ?? null,
        drive_watch_expiry: expiration,
        drive_watch_spreadsheet_id: spreadsheetId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({ channelId, resourceId: watch.resourceId, expiration }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error('sheets-watch-start error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
