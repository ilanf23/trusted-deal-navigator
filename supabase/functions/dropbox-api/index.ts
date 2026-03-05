import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')!;
const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DropboxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function refreshDropboxToken(refreshToken: string): Promise<DropboxTokenResponse> {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox token refresh error:', error);
    throw new Error('Failed to refresh Dropbox token');
  }

  return response.json();
}

function parseDropboxApiError(operation: string, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText);
    const requiredScope = parsed?.error?.required_scope;
    const errorTag = parsed?.error?.['.tag'];

    if (errorTag === 'missing_scope' && requiredScope) {
      return `Dropbox app is missing required scope: ${requiredScope}. Update Dropbox app permissions and reconnect Dropbox.`;
    }

    if (parsed?.error_summary) {
      return `Failed to ${operation}: ${parsed.error_summary}`;
    }
  } catch {
    // non-JSON error response
  }

  return `Failed to ${operation}`;
}

async function getValidAccessToken(supabase: any): Promise<string> {
  const { data: connection, error } = await supabase
    .from('dropbox_connections')
    .select('*')
    .limit(1)
    .single();

  if (error || !connection) {
    throw new Error('Dropbox not connected');
  }

  const tokenExpiry = new Date(connection.token_expiry);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Refreshing Dropbox access token...');
    const tokens = await refreshDropboxToken(connection.refresh_token);

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('dropbox_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq('id', connection.id);

    return tokens.access_token;
  }

  return connection.access_token;
}

// --- Action handlers ---

async function handleList(accessToken: string, body: any) {
  const path = body.path ?? '';
  const cursor = body.cursor;

  let url: string;
  let payload: any;

  if (cursor) {
    url = 'https://api.dropboxapi.com/2/files/list_folder/continue';
    payload = { cursor };
  } else {
    url = 'https://api.dropboxapi.com/2/files/list_folder';
    payload = {
      path,
      limit: 100,
      include_mounted_folders: true,
      include_non_downloadable_files: false,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox list_folder error:', error);
    throw new Error(parseDropboxApiError('list folder', error));
  }

  const data = await response.json();
  return {
    entries: data.entries,
    has_more: data.has_more,
    cursor: data.cursor,
  };
}

async function handleUpload(accessToken: string, body: any, supabase: any) {
  const { path, content } = body;

  if (!path || !content) {
    throw new Error('Missing path or content for upload');
  }

  // Decode base64 content to Uint8Array
  const binaryString = atob(content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': new TextEncoder().encode(JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
      })).reduce((acc, byte) => acc + String.fromCharCode(byte), ''),
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox upload error:', error);
    throw new Error(parseDropboxApiError('upload file', error));
  }

  const metadata = await response.json();

  // Upsert into dropbox_files table
  await supabase
    .from('dropbox_files')
    .upsert(
      {
        dropbox_id: metadata.id,
        dropbox_path: metadata.path_lower,
        dropbox_path_display: metadata.path_display,
        dropbox_rev: metadata.rev,
        name: metadata.name,
        is_folder: false,
        size: metadata.size,
        content_hash: metadata.content_hash,
        modified_at: metadata.server_modified,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'dropbox_id' }
    );

  return metadata;
}

async function handleGetTemporaryLink(accessToken: string, body: any) {
  const { path } = body;

  if (!path) {
    throw new Error('Missing path for get-temporary-link');
  }

  const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox get_temporary_link error:', error);
    throw new Error(parseDropboxApiError('get temporary link', error));
  }

  const data = await response.json();
  return { link: data.link, metadata: data.metadata };
}

async function handleMove(accessToken: string, body: any, supabase: any) {
  const { from_path, to_path } = body;

  if (!from_path || !to_path) {
    throw new Error('Missing from_path or to_path for move');
  }

  const response = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from_path,
      to_path,
      autorename: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox move_v2 error:', error);
    throw new Error(parseDropboxApiError('move file', error));
  }

  const data = await response.json();
  const metadata = data.metadata;

  // Update dropbox_files with new path info
  await supabase
    .from('dropbox_files')
    .update({
      dropbox_path: metadata.path_lower,
      dropbox_path_display: metadata.path_display,
      name: metadata.name,
      synced_at: new Date().toISOString(),
    })
    .eq('dropbox_path', from_path.toLowerCase());

  return metadata;
}

async function handleDelete(accessToken: string, body: any, supabase: any) {
  const { path } = body;

  if (!path) {
    throw new Error('Missing path for delete');
  }

  const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox delete_v2 error:', error);
    throw new Error(parseDropboxApiError('delete file', error));
  }

  const data = await response.json();

  // Remove from dropbox_files
  await supabase
    .from('dropbox_files')
    .delete()
    .eq('dropbox_path', path.toLowerCase());

  return data.metadata;
}

async function handleCreateFolder(accessToken: string, body: any) {
  const { path } = body;

  if (!path) {
    throw new Error('Missing path for create-folder');
  }

  const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      autorename: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox create_folder_v2 error:', error);
    throw new Error(parseDropboxApiError('create folder', error));
  }

  const data = await response.json();
  return data.metadata;
}

async function handleLinkToLead(body: any, supabase: any) {
  const { fileId, leadId, leadName } = body;

  if (!fileId) {
    throw new Error('Missing fileId for link-to-lead');
  }

  const { error } = await supabase
    .from('dropbox_files')
    .update({
      lead_id: leadId,
      lead_name: leadName,
    })
    .eq('id', fileId);

  if (error) {
    console.error('Error linking file to lead:', error);
    throw new Error('Failed to link file to lead');
  }

  return { success: true, fileId, leadId, leadName };
}

async function handleSearchContent(body: any, supabase: any) {
  const { query, leadId } = body;

  if (!query) {
    throw new Error('Missing query for search-content');
  }

  // Build the full-text search query
  const tsQuery = query
    .trim()
    .split(/\s+/)
    .map((term: string) => `${term}:*`)
    .join(' & ');

  let sqlQuery = supabase
    .from('dropbox_files')
    .select('id, name, dropbox_path_display, lead_id, lead_name, extracted_text, modified_at, size')
    .textSearch('extracted_text', tsQuery);

  if (leadId) {
    sqlQuery = sqlQuery.eq('lead_id', leadId);
  }

  const { data, error } = await sqlQuery.limit(50);

  if (error) {
    console.error('Search error:', error);
    throw new Error('Failed to search files');
  }

  // Generate snippets from extracted_text around the query terms
  const results = (data || []).map((file: any) => {
    let snippet = '';
    if (file.extracted_text) {
      const lowerText = file.extracted_text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const idx = lowerText.indexOf(lowerQuery);
      if (idx >= 0) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(file.extracted_text.length, idx + lowerQuery.length + 80);
        snippet = (start > 0 ? '...' : '') + file.extracted_text.substring(start, end) + (end < file.extracted_text.length ? '...' : '');
      } else {
        snippet = file.extracted_text.substring(0, 160) + (file.extracted_text.length > 160 ? '...' : '');
      }
    }

    return {
      id: file.id,
      name: file.name,
      path: file.dropbox_path_display,
      lead_id: file.lead_id,
      lead_name: file.lead_name,
      modified_at: file.modified_at,
      size: file.size,
      snippet,
    };
  });

  return { results, count: results.length };
}

// --- Admin role cache ---

const adminRoleCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-api', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for DB operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create client with user's auth header for JWT validation
    const supabaseAnon = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify JWT using getUser (getClaims can return null in edge environments)
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !userData?.user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    // Check admin role cache first
    const cachedRole = adminRoleCache.get(userId);
    let isAdmin = false;

    if (cachedRole && (Date.now() - cachedRole.timestamp) < CACHE_TTL) {
      isAdmin = cachedRole.isAdmin;
    } else {
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

      isAdmin = !!roleData;
      adminRoleCache.set(userId, { isAdmin, timestamp: Date.now() });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body - action comes from body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Some actions may not have a body
    }

    const action = body.action || new URL(req.url).searchParams.get('action');

    // Get shared Dropbox access token
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseAdmin);
    } catch (e) {
      // link-to-lead and search-content are DB-only actions that don't need Dropbox token
      if (action === 'link-to-lead' || action === 'search-content') {
        let result: any;

        if (action === 'link-to-lead') {
          result = await handleLinkToLead(body, supabaseAdmin);
        } else {
          result = await handleSearchContent(body, supabaseAdmin);
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Dropbox not connected', needsAuth: true }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: any;

    switch (action) {
      case 'list':
        result = await handleList(accessToken, body);
        break;

      case 'upload':
        result = await handleUpload(accessToken, body, supabaseAdmin);
        break;

      case 'download':
      case 'get-temporary-link':
        result = await handleGetTemporaryLink(accessToken, body);
        break;

      case 'move':
      case 'rename':
        result = await handleMove(accessToken, body, supabaseAdmin);
        break;

      case 'delete':
        result = await handleDelete(accessToken, body, supabaseAdmin);
        break;

      case 'create-folder':
        result = await handleCreateFolder(accessToken, body);
        break;

      case 'link-to-lead':
        result = await handleLinkToLead(body, supabaseAdmin);
        break;

      case 'search-content':
        result = await handleSearchContent(body, supabaseAdmin);
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Dropbox API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
