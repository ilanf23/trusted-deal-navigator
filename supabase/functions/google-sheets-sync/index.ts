import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

const DEFAULT_COLUMN_MAPPING: Record<string, string> = {
  '0': 'name',
  '1': 'volume_log_status',
  '2': 'company_name',
  '3': 'deal_value',
  '4': 'loan_category',
  '5': 'loan_stage',
  '6': 'won',
  '7': 'assigned_to',
  '8': 'lender_name',
  '9': 'lender_type',
  '10': 'fee_percent',
  '11': 'potential_revenue',
  '12': 'net_revenue',
  '13': 'target_closing_date',
  '14': 'wu_date',
  '15': 'source',
  '16': 'clx_agreement',
  '17': 'referral_source',
  '18': 'rs_fee_percent',
  '19': 'rs_revenue',
  '20': 'invoice_amount',
  '21': 'actual_net_revenue',
  '22': 'loss_reason',
};

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

function fuzzyMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return normalize(a) === normalize(b);
}

function columnIndexToLetter(index: number): string {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

function parseSheetValue(value: string | undefined, field: string): any {
  if (value === undefined || value === null || value === '') return null;

  const numericFields = [
    'deal_value', 'fee_percent', 'potential_revenue', 'net_revenue',
    'rs_fee_percent', 'rs_revenue', 'invoice_amount', 'actual_net_revenue',
  ];
  const booleanFields = ['won', 'clx_agreement'];
  const dateFields = ['target_closing_date', 'wu_date'];

  if (numericFields.includes(field)) {
    const cleaned = value.replace(/[$,%\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  if (booleanFields.includes(field)) {
    const lower = value.toLowerCase().trim();
    return lower === 'yes' || lower === 'true' || lower === '1' || lower === 'won';
  }

  if (dateFields.includes(field)) {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? value : parsed.toISOString().split('T')[0];
  }

  return value.trim();
}

function leadValueToSheetString(value: any, field: string): string {
  if (value === null || value === undefined) return '';

  const booleanFields = ['won', 'clx_agreement'];
  if (booleanFields.includes(field)) {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

// ────────────────────────────────────────────
// Action handlers
// ────────────────────────────────────────────

async function handlePull(
  body: any,
  supabaseAdmin: any,
  accessToken: string,
  userId: string
) {
  // Get sync config
  const { data: config, error: configError } = await supabaseAdmin
    .from('volume_log_sync_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (configError || !config) {
    return new Response(
      JSON.stringify({ error: 'No sync configuration found. Please save a config first.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { spreadsheet_id, sheet_name, column_mapping, header_row } = config;
  const mapping: Record<string, string> = column_mapping || DEFAULT_COLUMN_MAPPING;
  const headerRowIndex = header_row ?? 1;

  // Fetch sheet data
  const range = sheet_name ? `'${sheet_name}'` : 'Sheet1';
  const sheetsResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!sheetsResponse.ok) {
    const error = await sheetsResponse.text();
    console.error('Sheets API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to read spreadsheet data' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const sheetsData = await sheetsResponse.json();
  const rows: string[][] = sheetsData.values || [];

  if (rows.length <= headerRowIndex) {
    return new Response(
      JSON.stringify({ success: true, synced: 0, created: 0, updated: 0, message: 'No data rows found' }),
      { headers: corsHeaders }
    );
  }

  // Get existing leads to match against
  const { data: existingLeads } = await supabaseAdmin
    .from('potential')
    .select('id, name, sheets_row_index');

  const leadsByRowIndex = new Map<number, any>();
  const leadsByName = new Map<string, any>();
  if (existingLeads) {
    for (const lead of existingLeads) {
      if (lead.sheets_row_index !== null && lead.sheets_row_index !== undefined) {
        leadsByRowIndex.set(lead.sheets_row_index, lead);
      }
      if (lead.name) {
        leadsByName.set(lead.name.toLowerCase().trim(), lead);
      }
    }
  }

  let created = 0;
  let updated = 0;

  // Process data rows (skip header)
  for (let i = headerRowIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Build lead data from row using column mapping
    const leadData: Record<string, any> = {};
    for (const [colIndex, field] of Object.entries(mapping)) {
      const cellValue = row[parseInt(colIndex)];
      const parsed = parseSheetValue(cellValue, field);
      if (parsed !== null) {
        leadData[field] = parsed;
      }
    }

    // Skip rows without a name
    if (!leadData.name) continue;

    leadData.sheets_row_index = i;
    leadData.sheets_last_synced_at = new Date().toISOString();

    // Match existing lead: by row index first, then by name
    let existingLead = leadsByRowIndex.get(i);
    if (!existingLead) {
      // Try fuzzy name match
      for (const [name, lead] of leadsByName.entries()) {
        if (fuzzyMatch(leadData.name, name)) {
          existingLead = lead;
          break;
        }
      }
    }

    if (existingLead) {
      // Update existing lead
      const { error: updateError } = await supabaseAdmin
        .from('potential')
        .update(leadData)
        .eq('id', existingLead.id);

      if (updateError) {
        console.error(`Failed to update lead ${existingLead.id}:`, updateError);
      } else {
        updated++;
      }
    } else {
      // Create new lead
      const { error: insertError } = await supabaseAdmin
        .from('potential')
        .insert(leadData);

      if (insertError) {
        console.error(`Failed to create lead for row ${i}:`, insertError);
      } else {
        created++;
      }
    }
  }

  // Update last_pull_at on sync config
  await supabaseAdmin
    .from('volume_log_sync_config')
    .update({ last_pull_at: new Date().toISOString() })
    .eq('id', config.id);

  return new Response(
    JSON.stringify({ success: true, synced: created + updated, created, updated }),
    { headers: corsHeaders }
  );
}

async function handlePush(
  body: any,
  supabaseAdmin: any,
  accessToken: string
) {
  const { leadIds } = body;

  // Get sync config
  const { data: config, error: configError } = await supabaseAdmin
    .from('volume_log_sync_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (configError || !config) {
    return new Response(
      JSON.stringify({ error: 'No sync configuration found. Please save a config first.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { spreadsheet_id, sheet_name, column_mapping } = config;
  const mapping: Record<string, string> = column_mapping || DEFAULT_COLUMN_MAPPING;

  // Invert the mapping: field -> column index
  const fieldToCol: Record<string, number> = {};
  for (const [colIndex, field] of Object.entries(mapping)) {
    fieldToCol[field] = parseInt(colIndex);
  }

  // Get leads to push
  let leadsQuery = supabaseAdmin
    .from('potential')
    .select('*')
    .not('sheets_row_index', 'is', null);

  if (leadIds && leadIds.length > 0) {
    leadsQuery = leadsQuery.in('id', leadIds);
  } else {
    // Push all leads changed since last sync
    if (config.last_push_at) {
      leadsQuery = leadsQuery.gt('updated_at', config.last_push_at);
    }
  }

  const { data: leads, error: leadsError } = await leadsQuery;

  if (leadsError) {
    console.error('Failed to fetch leads for push:', leadsError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch leads' }),
      { status: 500, headers: corsHeaders }
    );
  }

  if (!leads || leads.length === 0) {
    return new Response(
      JSON.stringify({ success: true, pushed: 0, message: 'No leads to push' }),
      { headers: corsHeaders }
    );
  }

  const resolvedSheetName = sheet_name || 'Sheet1';
  let pushed = 0;

  for (const lead of leads) {
    // Determine the max column index to build the row
    const maxCol = Math.max(...Object.keys(mapping).map(Number));
    const rowValues: string[] = new Array(maxCol + 1).fill('');

    for (const [field, colIndex] of Object.entries(fieldToCol)) {
      if (lead[field] !== undefined) {
        rowValues[colIndex] = leadValueToSheetString(lead[field], field);
      }
    }

    const rowNumber = lead.sheets_row_index + 1; // Sheets API is 1-based
    const rangeStr = `'${resolvedSheetName}'!A${rowNumber}:${columnIndexToLetter(maxCol)}${rowNumber}`;

    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(rangeStr)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: rangeStr,
          majorDimension: 'ROWS',
          values: [rowValues],
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error(`Failed to push lead ${lead.id} to row ${rowNumber}:`, error);
      continue;
    }

    // Update sheets_last_synced_at on the lead
    await supabaseAdmin
      .from('potential')
      .update({ sheets_last_synced_at: new Date().toISOString() })
      .eq('id', lead.id);

    pushed++;
  }

  // Update last_push_at on sync config
  await supabaseAdmin
    .from('volume_log_sync_config')
    .update({ last_push_at: new Date().toISOString() })
    .eq('id', config.id);

  return new Response(
    JSON.stringify({ success: true, pushed }),
    { headers: corsHeaders }
  );
}

async function handleUpdateCell(
  body: any,
  supabaseAdmin: any,
  accessToken: string
) {
  const { leadId, field, value } = body;

  if (!leadId || !field) {
    return new Response(
      JSON.stringify({ error: 'leadId and field are required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Get sync config
  const { data: config, error: configError } = await supabaseAdmin
    .from('volume_log_sync_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (configError || !config) {
    return new Response(
      JSON.stringify({ error: 'No sync configuration found.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { spreadsheet_id, sheet_name, column_mapping } = config;
  const mapping: Record<string, string> = column_mapping || DEFAULT_COLUMN_MAPPING;

  // Find the column index for this field
  let targetColIndex: number | null = null;
  for (const [colIndex, mappedField] of Object.entries(mapping)) {
    if (mappedField === field) {
      targetColIndex = parseInt(colIndex);
      break;
    }
  }

  if (targetColIndex === null) {
    return new Response(
      JSON.stringify({ error: `Field "${field}" is not mapped to any column` }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Get the lead's row index
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('potential')
    .select('sheets_row_index')
    .eq('id', leadId)
    .single();

  if (leadError || !lead || lead.sheets_row_index === null || lead.sheets_row_index === undefined) {
    return new Response(
      JSON.stringify({ error: 'Lead not found or has no sheets_row_index' }),
      { status: 404, headers: corsHeaders }
    );
  }

  const resolvedSheetName = sheet_name || 'Sheet1';
  const colLetter = columnIndexToLetter(targetColIndex);
  const rowNumber = lead.sheets_row_index + 1; // Sheets API is 1-based
  const cellRange = `'${resolvedSheetName}'!${colLetter}${rowNumber}`;
  const sheetValue = leadValueToSheetString(value, field);

  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: cellRange,
        majorDimension: 'ROWS',
        values: [[sheetValue]],
      }),
    }
  );

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    console.error(`Failed to update cell ${cellRange}:`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to update cell in Google Sheets' }),
      { status: 500, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: corsHeaders }
  );
}

async function handleSaveConfig(
  body: any,
  supabaseAdmin: any,
  userId: string
) {
  const { spreadsheetId, sheetName, columnMapping, headerRow } = body;

  if (!spreadsheetId) {
    return new Response(
      JSON.stringify({ error: 'spreadsheetId is required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Check if a config already exists
  const { data: existing } = await supabaseAdmin
    .from('volume_log_sync_config')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const configData = {
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName || 'Sheet1',
    column_mapping: columnMapping || DEFAULT_COLUMN_MAPPING,
    header_row: headerRow ?? 1,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabaseAdmin
      .from('volume_log_sync_config')
      .update(configData)
      .eq('id', existing.id);

    if (error) {
      console.error('Failed to update sync config:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update sync configuration' }),
        { status: 500, headers: corsHeaders }
      );
    }
  } else {
    const { error } = await supabaseAdmin
      .from('volume_log_sync_config')
      .insert({ ...configData, created_at: new Date().toISOString() });

    if (error) {
      console.error('Failed to create sync config:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create sync configuration' }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: corsHeaders }
  );
}

async function handleGetConfig(supabaseAdmin: any) {
  const { data: config, error } = await supabaseAdmin
    .from('volume_log_sync_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to get sync config:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get sync configuration' }),
      { status: 500, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({ config: config || null }),
    { headers: corsHeaders }
  );
}

// ────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'google-sheets-sync', 30, 60);
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
      global: { headers: { Authorization: authHeader } },
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

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from('users')
      .select('app_role')
      .eq('user_id', userId)
      .in('app_role', ['admin', 'super_admin'])
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { action, teamMemberName } = body;

    // Actions that don't need Google Sheets connection
    if (action === 'saveConfig') {
      return await handleSaveConfig(body, supabaseAdmin, userId);
    }

    if (action === 'getConfig') {
      return await handleGetConfig(supabaseAdmin);
    }

    // Actions that need Google Sheets connection
    let connectionQuery = supabaseAdmin
      .from('sheets_connections')
      .select('*');

    if (teamMemberName) {
      connectionQuery = connectionQuery.eq('user_name', teamMemberName);
    } else {
      connectionQuery = connectionQuery.eq('user_id', userId);
    }

    const { data: connection, error: connError } = await connectionQuery.single();

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

    if (action === 'pull') {
      return await handlePull(body, supabaseAdmin, accessToken, userId);
    }

    if (action === 'push') {
      return await handlePush(body, supabaseAdmin, accessToken);
    }

    if (action === 'updateCell') {
      return await handleUpdateCell(body, supabaseAdmin, accessToken);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Supported: pull, push, updateCell, saveConfig, getConfig' }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in google-sheets-sync:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
