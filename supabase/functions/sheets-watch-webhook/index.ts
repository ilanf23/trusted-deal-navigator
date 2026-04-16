// Public webhook. Receives Google Drive push notifications.
// Validates the channel by looking it up in sheets_connections, then inserts
// a row into sheets_change_events (broadcast via Supabase Realtime to the client).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-id, x-goog-resource-state',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimited = await enforceRateLimit(req, 'sheets-watch-webhook', 300, 60);
  if (rateLimited) return rateLimited;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const resourceState = req.headers.get('x-goog-resource-state') ?? 'unknown';

    // Google fires a 'sync' ping once when the channel is first created; ignore it.
    if (!channelId || resourceState === 'sync') {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: connection } = await admin
      .from('sheets_connections')
      .select('id, drive_watch_channel_id, drive_watch_resource_id, drive_watch_spreadsheet_id')
      .eq('drive_watch_channel_id', channelId)
      .maybeSingle();

    // Unknown channel (already stopped, or spoofed). Return 200 so Google stops retrying.
    if (!connection || !connection.drive_watch_spreadsheet_id) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Belt-and-suspenders: resourceId should match what we stored.
    if (resourceId && connection.drive_watch_resource_id && resourceId !== connection.drive_watch_resource_id) {
      console.warn('resourceId mismatch for channel', channelId);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    await admin.from('sheets_change_events').insert({
      spreadsheet_id: connection.drive_watch_spreadsheet_id,
      channel_id: channelId,
      resource_state: resourceState,
    });

    // Opportunistic TTL cleanup. Drive fires frequently enough that this keeps the table lean.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    admin
      .from('sheets_change_events')
      .delete()
      .lt('created_at', oneHourAgo)
      .then(() => {}, (err: any) => console.warn('TTL cleanup error:', err));

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('sheets-watch-webhook error:', err);
    // Return 200 anyway — Google will retry otherwise, and we don't want retry storms on transient errors.
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
