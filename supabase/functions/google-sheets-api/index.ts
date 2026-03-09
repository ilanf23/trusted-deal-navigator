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
  connection: { access_token: string; refresh_token: string; token_expiry: string; id: string },
  supabase: any
): Promise<string | null> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

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
      console.error('Sheets token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from('sheets_connections')
      .update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return data.access_token;
  } catch (err) {
    console.error('Error refreshing sheets token:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'google-sheets-api', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
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

    const userId = claimsData.user.id;
    const { action, spreadsheetId, sheetName, teamMemberName } = await req.json();

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the sheets connection
    let query = supabaseAdmin
      .from('sheets_connections')
      .select('*');
    
    if (teamMemberName) {
      query = query.eq('team_member_name', teamMemberName);
    } else {
      query = query.eq('user_id', userId);
    }
    
    const { data: connection, error: connError } = await query.single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No sheets connection found. Please connect to Google Sheets first.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const accessToken = await getValidAccessToken(connection, supabaseAdmin);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to get valid access token. Please reconnect to Google Sheets.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (action === 'listSpreadsheets') {
      // List spreadsheets from Google Drive
      const driveResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=50',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!driveResponse.ok) {
        const error = await driveResponse.text();
        console.error('Drive API error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to list spreadsheets' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const driveData = await driveResponse.json();
      
      return new Response(
        JSON.stringify({ 
          spreadsheets: driveData.files.map((f: { id: string; name: string; modifiedTime: string }) => ({
            id: f.id,
            name: f.name,
            modifiedTime: f.modifiedTime
          }))
        }),
        { headers: corsHeaders }
      );
    }

    if (action === 'getSheets') {
      if (!spreadsheetId) {
        return new Response(
          JSON.stringify({ error: 'spreadsheetId is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Get spreadsheet metadata to list sheets
      const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!sheetsResponse.ok) {
        const error = await sheetsResponse.text();
        console.error('Sheets API error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to get spreadsheet sheets' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const sheetsData = await sheetsResponse.json();
      
      return new Response(
        JSON.stringify({ 
          sheets: sheetsData.sheets.map((s: { properties: { sheetId: number; title: string } }) => ({
            id: s.properties.sheetId,
            title: s.properties.title
          }))
        }),
        { headers: corsHeaders }
      );
    }

    if (action === 'getData') {
      if (!spreadsheetId) {
        return new Response(
          JSON.stringify({ error: 'spreadsheetId is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const range = sheetName ? `'${sheetName}'` : 'Sheet1';
      
      const dataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!dataResponse.ok) {
        const error = await dataResponse.text();
        console.error('Sheets API error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to get spreadsheet data' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const dataResult = await dataResponse.json();
      
      return new Response(
        JSON.stringify({ 
          values: dataResult.values || [],
          range: dataResult.range
        }),
        { headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in google-sheets-api:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
