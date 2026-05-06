import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { getValidAccessToken, parseDropboxApiError } from '../_shared/dropbox/api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// === Handlers (copied verbatim from supabase/functions/dropbox-api/index.ts) ===

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

async function handleListShared(accessToken: string) {
  const response = await fetch('https://api.dropboxapi.com/2/sharing/list_received_files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit: 100 }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox list shared files error:', error);
    throw new Error(parseDropboxApiError('list shared files', error));
  }

  const data = await response.json();
  const entries = (data.entries || []).map((e: any) => ({
    '.tag': 'file',
    id: e.id,
    name: e.name,
    path_lower: e.path_lower || '',
    path_display: e.path_display || e.name,
    size: e.size,
    server_modified: e.time_invited || e.server_modified,
  }));

  return { entries };
}

async function handleListRecursive(accessToken: string, body: any) {
  const path = body.path ?? '';
  const includeDeleted = body.include_deleted ?? false;
  const fileExtensions: string[] | undefined = body.file_extensions;
  const maxEntries = 1000;

  const payload: any = {
    path,
    recursive: true,
    limit: 2000,
    include_mounted_folders: true,
    include_non_downloadable_files: false,
  };
  if (includeDeleted) {
    payload.include_deleted = true;
  }

  const filterEntry = fileExtensions?.length
    ? (entry: any) => {
        if (entry['.tag'] !== 'file') return false;
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        return fileExtensions.includes(ext);
      }
    : null;

  const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox list_folder recursive error:', error);
    throw new Error(parseDropboxApiError('list folder', error));
  }

  const data = await response.json();
  let entries = filterEntry ? data.entries.filter(filterEntry) : data.entries;

  // Continue fetching if there are more entries (up to maxEntries)
  let cursor = data.cursor;
  let hasMore = data.has_more;

  while (hasMore && entries.length < maxEntries) {
    const contResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor }),
    });

    if (!contResponse.ok) break;

    const contData = await contResponse.json();
    const batch = filterEntry ? contData.entries.filter(filterEntry) : contData.entries;
    entries = entries.concat(batch);
    cursor = contData.cursor;
    hasMore = contData.has_more;
  }

  return { entries };
}

// === Server ===

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-files', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body.action || new URL(req.url).searchParams.get('action');

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseAdmin);
    } catch {
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
      case 'download':
      case 'get-temporary-link':
        result = await handleGetTemporaryLink(accessToken, body);
        break;
      case 'list-recursive':
        result = await handleListRecursive(accessToken, body);
        break;
      case 'list-shared':
        result = await handleListShared(accessToken);
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
    console.error('dropbox-files error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
