import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

async function getValidAccessToken(
  connection: { access_token: string; refresh_token: string; token_expiry: string; user_id: string; id: string },
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  // If token is still valid (with 5 min buffer), return it
  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  // Refresh the token
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from('calendar_connections')
      .update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return data.access_token;
  } catch (err) {
    console.error('Error refreshing token:', err);
    return null;
  }
}

async function syncToGoogle(
  accessToken: string,
  appointment: Record<string, unknown>,
  calendarId: string | null
): Promise<string | null> {
  const calId = calendarId || 'primary';

  const event = {
    summary: appointment.title,
    description: appointment.description || '',
    start: {
      dateTime: appointment.start_time,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: appointment.end_time || appointment.start_time,
      timeZone: 'America/New_York',
    },
  };

  try {
    let response: Response;

    if (appointment.google_event_id) {
      // Update existing event
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${appointment.google_event_id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );
    } else {
      // Create new event
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );
    }

    if (!response.ok) {
      console.error('Google Calendar API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (err) {
    console.error('Error syncing to Google Calendar:', err);
    return null;
  }
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

async function fetchFromGoogle(
  accessToken: string,
  calendarId: string | null,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const calId = calendarId || 'primary';

  try {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
    );
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error('Google Calendar fetch error:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (err) {
    console.error('Error fetching from Google Calendar:', err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'google-calendar-sync', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, appointmentId } = body;

    // Handle scheduled sync (called by cron job without user auth)
    if (action === 'scheduledSync') {
      console.log('Running scheduled sync for all connected calendars...');
      
      const { data: connections, error: connErr } = await supabase
        .from('calendar_connections')
        .select('*');

      if (connErr || !connections?.length) {
        console.log('No calendar connections found');
        return new Response(
          JSON.stringify({ success: true, message: 'No calendars to sync', synced: 0 }),
          { headers: corsHeaders }
        );
      }

      let totalImported = 0;
      let totalUpdated = 0;

      for (const connection of connections) {
        try {
          const accessToken = await getValidAccessToken(connection, supabase);
          if (!accessToken) {
            console.error(`Failed to get token for user ${connection.user_id}`);
            continue;
          }

          const now = new Date();
          const timeMin = now.toISOString();
          const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

          const googleEvents = await fetchFromGoogle(accessToken, connection.calendar_id, timeMin, timeMax);

          for (const event of googleEvents) {
            if (!event.start?.dateTime) continue;

            const { data: existing } = await supabase
              .from('evan_appointments')
              .select('id')
              .eq('google_event_id', event.id)
              .single();

            if (existing) {
              await supabase
                .from('evan_appointments')
                .update({
                  title: event.summary || 'Untitled Event',
                  description: event.description || null,
                  start_time: event.start.dateTime,
                  end_time: event.end?.dateTime || null,
                  synced_at: new Date().toISOString(),
                  sync_status: 'synced',
                })
                .eq('id', existing.id);
              totalUpdated++;
            } else {
              await supabase
                .from('evan_appointments')
                .insert({
                  title: event.summary || 'Untitled Event',
                  description: event.description || null,
                  start_time: event.start.dateTime,
                  end_time: event.end?.dateTime || null,
                  google_event_id: event.id,
                  google_calendar_id: connection.calendar_id,
                  synced_at: new Date().toISOString(),
                  sync_status: 'synced',
                  appointment_type: 'imported',
                  team_member_name: connection.team_member_name || 'evan',
                });
              totalImported++;
            }
          }

          console.log(`Synced calendar for user ${connection.user_id}: ${googleEvents.length} events`);
        } catch (err) {
          console.error(`Error syncing calendar for user ${connection.user_id}:`, err);
        }
      }

      return new Response(
        JSON.stringify({ success: true, imported: totalImported, updated: totalUpdated }),
        { headers: corsHeaders }
      );
    }

    // For user-initiated actions, verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = userData.user.id;

    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No calendar connected' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const accessToken = await getValidAccessToken(connection, supabase);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to get access token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (action === 'syncAppointment') {
      const { data: appointment, error: apptError } = await supabase
        .from('evan_appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (apptError || !appointment) {
        return new Response(
          JSON.stringify({ error: 'Appointment not found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      const eventId = await syncToGoogle(accessToken, appointment, connection.calendar_id);

      if (eventId) {
        await supabase
          .from('evan_appointments')
          .update({
            google_event_id: eventId,
            google_calendar_id: connection.calendar_id,
            synced_at: new Date().toISOString(),
            sync_status: 'synced',
          })
          .eq('id', appointmentId);

        return new Response(
          JSON.stringify({ success: true, eventId }),
          { headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to sync appointment' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (action === 'syncAll') {
      const { data: appointments, error: apptError } = await supabase
        .from('evan_appointments')
        .select('*')
        .or('sync_status.is.null,sync_status.eq.pending')
        .gte('start_time', new Date().toISOString());

      if (apptError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch appointments' }),
          { status: 500, headers: corsHeaders }
        );
      }

      let synced = 0;
      let failed = 0;

      for (const appointment of appointments || []) {
        const eventId = await syncToGoogle(accessToken, appointment, connection.calendar_id);
        if (eventId) {
          await supabase
            .from('evan_appointments')
            .update({
              google_event_id: eventId,
              google_calendar_id: connection.calendar_id,
              synced_at: new Date().toISOString(),
              sync_status: 'synced',
            })
            .eq('id', appointment.id);
          synced++;
        } else {
          await supabase
            .from('evan_appointments')
            .update({ sync_status: 'failed' })
            .eq('id', appointment.id);
          failed++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, synced, failed }),
        { headers: corsHeaders }
      );
    }

    if (action === 'importFromGoogle') {
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const googleEvents = await fetchFromGoogle(accessToken, connection.calendar_id, timeMin, timeMax);

      let imported = 0;
      let updated = 0;

      for (const event of googleEvents) {
        if (!event.start?.dateTime) continue;

        const { data: existing } = await supabase
          .from('evan_appointments')
          .select('id')
          .eq('google_event_id', event.id)
          .single();

        if (existing) {
          await supabase
            .from('evan_appointments')
            .update({
              title: event.summary || 'Untitled Event',
              description: event.description || null,
              start_time: event.start.dateTime,
              end_time: event.end?.dateTime || null,
              synced_at: new Date().toISOString(),
              sync_status: 'synced',
            })
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase
            .from('evan_appointments')
            .insert({
              title: event.summary || 'Untitled Event',
              description: event.description || null,
              start_time: event.start.dateTime,
              end_time: event.end?.dateTime || null,
              google_event_id: event.id,
              google_calendar_id: connection.calendar_id,
              synced_at: new Date().toISOString(),
              sync_status: 'synced',
              appointment_type: 'imported',
              team_member_name: connection.team_member_name || 'evan',
            });
          imported++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, imported, updated }),
        { headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in google-calendar-sync:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});