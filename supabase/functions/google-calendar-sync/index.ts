import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

// Refresh access token if expired
async function getValidAccessToken(connection: any, supabase: any): Promise<string | null> {
  const now = new Date();
  const expiry = new Date(connection.token_expiry);

  // If token is still valid (with 5 min buffer), return it
  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  // Refresh the token
  console.log('Refreshing access token...');
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

  const tokens = await response.json();

  if (tokens.error) {
    console.error('Token refresh error:', tokens);
    return null;
  }

  // Update the stored token
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase
    .from('calendar_connections')
    .update({
      access_token: tokens.access_token,
      token_expiry: newExpiry,
    })
    .eq('id', connection.id);

  return tokens.access_token;
}

// Create or update a Google Calendar event
async function syncToGoogle(accessToken: string, appointment: any, calendarId: string): Promise<string | null> {
  const event = {
    summary: appointment.title,
    description: appointment.description || '',
    start: {
      dateTime: appointment.start_time,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: appointment.end_time || new Date(new Date(appointment.start_time).getTime() + 60 * 60 * 1000).toISOString(),
      timeZone: 'America/New_York',
    },
  };

  let response;
  
  if (appointment.google_event_id) {
    // Update existing event
    response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${appointment.google_event_id}`,
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
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
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
    const error = await response.text();
    console.error('Google Calendar API error:', error);
    return null;
  }

  const result = await response.json();
  return result.id;
}

// Fetch events from Google Calendar
async function fetchFromGoogle(accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<any[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error('Failed to fetch events:', await response.text());
    return [];
  }

  const data = await response.json();
  return data.items || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify the user
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
    const { action, appointmentId } = await req.json();

    // Get user's calendar connection
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

    // Get valid access token
    const accessToken = await getValidAccessToken(connection, supabase);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to get access token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (action === 'syncAppointment') {
      // Sync a single appointment to Google Calendar
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
      // Sync all pending appointments
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
      // Import events from Google Calendar (two-way sync)
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      const googleEvents = await fetchFromGoogle(accessToken, connection.calendar_id, timeMin, timeMax);

      let imported = 0;
      let updated = 0;

      for (const event of googleEvents) {
        if (!event.start?.dateTime) continue; // Skip all-day events

        // Check if we already have this event
        const { data: existing } = await supabase
          .from('evan_appointments')
          .select('id')
          .eq('google_event_id', event.id)
          .single();

        if (existing) {
          // Update existing appointment
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
          // Create new appointment from Google event
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
