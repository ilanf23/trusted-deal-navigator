import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  getValidAccessToken,
  parseDropboxApiError,
  sanitizeDropboxPath,
} from '../_shared/dropbox/api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// === Handlers (copied verbatim from supabase/functions/dropbox-api/index.ts) ===

async function handleUpload(accessToken: string, body: any, supabase: any) {
  const { path, content, mode: uploadMode } = body;

  if (!path || !content) {
    throw new Error('Missing path or content for upload');
  }

  // Decode base64 content to Uint8Array
  const binaryString = atob(content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dropboxMode = uploadMode === 'overwrite' ? 'overwrite' : 'add';

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': new TextEncoder().encode(JSON.stringify({
        path,
        mode: dropboxMode,
        autorename: dropboxMode === 'add',
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

async function handleUploadToLeadFolder(accessToken: string, body: any, supabase: any) {
  const { leadName, companyName, leadId, fileName, content } = body;

  if (!leadName || !leadId || !fileName || !content) {
    throw new Error('Missing required fields: leadName, leadId, fileName, content');
  }

  // Build folder name: "Company - Name" or just "Name" if no company
  const sanitizedCompany = companyName ? sanitizeDropboxPath(companyName) : '';
  const sanitizedLead = sanitizeDropboxPath(leadName);
  const folderName = sanitizedCompany
    ? `${sanitizedCompany} - ${sanitizedLead}`
    : sanitizedLead;
  const folderPath = `/Leads/${folderName}`;

  // Create folder (ignore conflict if it already exists)
  const folderResponse = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: folderPath, autorename: false }),
  });

  if (!folderResponse.ok) {
    const errorText = await folderResponse.text();
    try {
      const parsed = JSON.parse(errorText);
      const pathTag = parsed?.error?.path?.['.tag'];
      if (pathTag !== 'conflict') {
        throw new Error(parseDropboxApiError('create lead folder', errorText));
      }
      // conflict = folder already exists, continue
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error('Failed to create lead folder');
      }
      throw e;
    }
  }

  // Upload file to the folder
  const filePath = `${folderPath}/${fileName}`;
  const binaryString = atob(content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': new TextEncoder().encode(JSON.stringify({
        path: filePath,
        mode: 'add',
        autorename: true,
      })).reduce((acc, byte) => acc + String.fromCharCode(byte), ''),
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    console.error('Dropbox upload error:', error);
    throw new Error(parseDropboxApiError('upload file to lead folder', error));
  }

  const metadata = await uploadResponse.json();

  // Upsert into dropbox_files with lead association
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
        lead_id: leadId,
        lead_name: leadName,
      },
      { onConflict: 'dropbox_id' }
    );

  return metadata;
}

// === Server ===

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-mutations', 60, 60);
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
      case 'upload':
        result = await handleUpload(accessToken, body, supabaseAdmin);
        break;
      case 'upload-to-lead-folder':
        result = await handleUploadToLeadFolder(accessToken, body, supabaseAdmin);
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
    console.error('dropbox-mutations error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
