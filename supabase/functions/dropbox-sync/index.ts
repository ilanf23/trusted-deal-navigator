import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { errorResponse } from '../_shared/responses.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')!;
const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.md', '.json', '.xml', '.html', '.htm', '.log', '.yml', '.yaml', '.ini', '.cfg', '.conf', '.tsv']);
const SKIP_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a',
  '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  '.exe', '.dll', '.so', '.dylib', '.bin',
]);
const MAX_EXTRACTED_TEXT = 50000;

interface DropboxConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  cursor: string | null;
}

interface DropboxEntry {
  '.tag': 'file' | 'folder' | 'deleted';
  id?: string;
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  rev?: string;
  content_hash?: string;
  server_modified?: string;
}

interface DropboxListFolderResult {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

async function refreshDropboxToken(connection: DropboxConnection, supabaseAdmin: any): Promise<string> {
  const tokenExpiry = new Date(connection.token_expiry);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Refreshing Dropbox access token...');
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DROPBOX_APP_KEY,
        client_secret: DROPBOX_APP_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Dropbox token refresh error:', error);
      throw new Error('Failed to refresh Dropbox token');
    }

    const tokens = await response.json();
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from('dropbox_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry,
      })
      .eq('id', connection.id);

    return tokens.access_token;
  }

  return connection.access_token;
}

async function getConnectionForUser(supabaseAdmin: any, userId: string): Promise<DropboxConnection> {
  const { data, error } = await supabaseAdmin
    .from('dropbox_connections')
    .select('id, user_id, access_token, refresh_token, token_expiry, cursor')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No Dropbox connection found');
  }

  return data as DropboxConnection;
}

async function getAllConnections(supabaseAdmin: any): Promise<DropboxConnection[]> {
  const { data, error } = await supabaseAdmin
    .from('dropbox_connections')
    .select('id, user_id, access_token, refresh_token, token_expiry, cursor')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch Dropbox connections');
  }

  return (data || []) as DropboxConnection[];
}

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.substring(dot).toLowerCase() : '';
}

async function processEntries(
  entries: DropboxEntry[],
  supabaseAdmin: any,
  userId: string,
): Promise<number> {
  let count = 0;

  for (const entry of entries) {
    if (entry['.tag'] === 'file') {
      const { error } = await supabaseAdmin
        .from('dropbox_files')
        .upsert(
          {
            user_id: userId,
            dropbox_id: entry.id,
            dropbox_path: entry.path_lower,
            dropbox_path_display: entry.path_display,
            name: entry.name,
            is_folder: false,
            size: entry.size,
            dropbox_rev: entry.rev,
            content_hash: entry.content_hash,
            modified_at: entry.server_modified,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,dropbox_id' },
        );

      if (error) {
        console.error(`Failed to upsert file ${entry.path_lower}:`, error);
      } else {
        count++;
      }
    } else if (entry['.tag'] === 'folder') {
      const { error } = await supabaseAdmin
        .from('dropbox_files')
        .upsert(
          {
            user_id: userId,
            dropbox_id: entry.id,
            dropbox_path: entry.path_lower,
            dropbox_path_display: entry.path_display,
            name: entry.name,
            is_folder: true,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,dropbox_id' },
        );

      if (error) {
        console.error(`Failed to upsert folder ${entry.path_lower}:`, error);
      } else {
        count++;
      }
    } else if (entry['.tag'] === 'deleted') {
      const { error } = await supabaseAdmin
        .from('dropbox_files')
        .delete()
        .eq('user_id', userId)
        .eq('dropbox_path', entry.path_lower);

      if (error) {
        console.error(`Failed to delete ${entry.path_lower}:`, error);
      } else {
        count++;
      }
    }
  }

  return count;
}

async function handleFullSync(connection: DropboxConnection, supabaseAdmin: any): Promise<{ synced: number; cursor: string | null; has_more: boolean }> {
  const accessToken = await refreshDropboxToken(connection, supabaseAdmin);

  let totalSynced = 0;
  let cursor: string | null = null;
  let hasMore = true;

  // Initial request
  const initialResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: '',
      recursive: true,
      limit: 2000,
      include_mounted_folders: true,
      include_non_downloadable_files: false,
    }),
  });

  if (!initialResponse.ok) {
    const error = await initialResponse.text();
    console.error('Dropbox list_folder error:', error);
    throw new Error(`Failed to list Dropbox folder: ${error}`);
  }

  let result: DropboxListFolderResult = await initialResponse.json();
  totalSynced += await processEntries(result.entries, supabaseAdmin, connection.user_id);
  cursor = result.cursor;
  hasMore = result.has_more;

  // Paginate with cursor
  while (hasMore) {
    const continueResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor }),
    });

    if (!continueResponse.ok) {
      const error = await continueResponse.text();
      console.error('Dropbox list_folder/continue error:', error);
      throw new Error(`Failed to continue listing: ${error}`);
    }

    result = await continueResponse.json();
    totalSynced += await processEntries(result.entries, supabaseAdmin, connection.user_id);
    cursor = result.cursor;
    hasMore = result.has_more;
  }

  // Save cursor and update last_sync_at
  await supabaseAdmin
    .from('dropbox_connections')
    .update({
      cursor,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return { synced: totalSynced, cursor, has_more: false };
}

async function handleIncrementalSync(connection: DropboxConnection, supabaseAdmin: any): Promise<{ changes: number; cursor: string | null; has_more: boolean; skipped?: boolean }> {
  if (!connection.cursor) {
    return { changes: 0, cursor: null, has_more: false, skipped: true };
  }

  const accessToken = await refreshDropboxToken(connection, supabaseAdmin);

  const response = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cursor: connection.cursor }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox incremental sync error:', error);
    throw new Error(`Failed to get changes: ${error}`);
  }

  const result: DropboxListFolderResult = await response.json();
  const changes = await processEntries(result.entries, supabaseAdmin, connection.user_id);

  // Save new cursor
  await supabaseAdmin
    .from('dropbox_connections')
    .update({
      cursor: result.cursor,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return { changes, cursor: result.cursor, has_more: result.has_more };
}

async function handleExtractText(connection: DropboxConnection, supabaseAdmin: any): Promise<Response> {
  const accessToken = await refreshDropboxToken(connection, supabaseAdmin);

  // Select batch of files pending extraction
  const { data: files, error: selectError } = await supabaseAdmin
    .from('dropbox_files')
    .select('id, dropbox_path, name')
    .eq('user_id', connection.user_id)
    .eq('extraction_status', 'pending')
    .eq('is_folder', false)
    .limit(10);

  if (selectError) {
    console.error('Failed to fetch pending files:', selectError);
    throw new Error('Failed to fetch pending files');
  }

  if (!files || files.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, completed: 0, failed: 0, skipped: 0 }),
      { headers: corsHeaders },
    );
  }

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const ext = getFileExtension(file.name);

    // Skip images, video, audio, archives, binaries
    if (SKIP_EXTENSIONS.has(ext)) {
      await supabaseAdmin
        .from('dropbox_files')
        .update({ extraction_status: 'skipped' })
        .eq('id', file.id);
      skipped++;
      continue;
    }

    // Skip .docx for now
    if (ext === '.docx') {
      await supabaseAdmin
        .from('dropbox_files')
        .update({ extraction_status: 'skipped' })
        .eq('id', file.id);
      skipped++;
      continue;
    }

    try {
      // Get temporary download link
      const linkResponse = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.dropbox_path }),
      });

      if (!linkResponse.ok) {
        const error = await linkResponse.text();
        throw new Error(`Failed to get temporary link: ${error}`);
      }

      const linkData = await linkResponse.json();
      const downloadUrl = linkData.link;

      let extractedText = '';

      if (TEXT_EXTENSIONS.has(ext)) {
        // Plain text files: download and read directly
        const contentResponse = await fetch(downloadUrl);
        if (!contentResponse.ok) {
          throw new Error(`Failed to download file: ${contentResponse.status}`);
        }
        extractedText = await contentResponse.text();
      } else if (ext === '.pdf') {
        // PDF: download and attempt basic text extraction
        const contentResponse = await fetch(downloadUrl);
        if (!contentResponse.ok) {
          throw new Error(`Failed to download PDF: ${contentResponse.status}`);
        }
        const pdfBytes = await contentResponse.arrayBuffer();
        const pdfText = new TextDecoder('utf-8', { fatal: false }).decode(pdfBytes);

        // Basic PDF text extraction: find text between BT and ET operators,
        // and extract string literals in parentheses or hex strings
        const textParts: string[] = [];
        // Extract text from Tj and TJ operators
        const tjRegex = /\(([^)]*)\)\s*Tj/g;
        let match;
        while ((match = tjRegex.exec(pdfText)) !== null) {
          textParts.push(match[1]);
        }
        // Also try to extract text between stream/endstream that looks like plain text
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        while ((match = streamRegex.exec(pdfText)) !== null) {
          const streamContent = match[1];
          // Only include if it looks like readable text (high ratio of printable chars)
          const printable = streamContent.replace(/[^\x20-\x7E\r\n\t]/g, '');
          if (printable.length > 20 && printable.length / streamContent.length > 0.7) {
            textParts.push(printable);
          }
        }

        extractedText = textParts.join('\n').trim();
        if (!extractedText) {
          extractedText = '[PDF content could not be extracted - may require OCR]';
        }
      } else {
        // Unknown extension: try to read as text
        const contentResponse = await fetch(downloadUrl);
        if (!contentResponse.ok) {
          throw new Error(`Failed to download file: ${contentResponse.status}`);
        }
        const rawText = await contentResponse.text();
        // Only keep if it looks like text (high ratio of printable chars)
        const printable = rawText.replace(/[^\x20-\x7E\r\n\t]/g, '');
        if (printable.length > 20 && printable.length / rawText.length > 0.7) {
          extractedText = printable;
        } else {
          await supabaseAdmin
            .from('dropbox_files')
            .update({ extraction_status: 'skipped' })
            .eq('id', file.id);
          skipped++;
          continue;
        }
      }

      // Cap extracted text
      if (extractedText.length > MAX_EXTRACTED_TEXT) {
        extractedText = extractedText.substring(0, MAX_EXTRACTED_TEXT);
      }

      await supabaseAdmin
        .from('dropbox_files')
        .update({
          extracted_text: extractedText,
          extraction_status: 'completed',
          extracted_at: new Date().toISOString(),
        })
        .eq('id', file.id);
      completed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Failed to extract text from ${file.name}:`, errorMessage);

      await supabaseAdmin
        .from('dropbox_files')
        .update({
          extraction_status: 'failed',
          extraction_error: errorMessage,
        })
        .eq('id', file.id);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      processed: files.length,
      completed,
      failed,
      skipped,
    }),
    { headers: corsHeaders },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-sync', 30, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action } = await req.json();
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace('Bearer ', '');
    const isServiceRole = bearer === SUPABASE_SERVICE_ROLE_KEY;

    let authUserId: string | null = null;
    if (!isServiceRole) {
      const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
      if (!authResult.ok) return authResult.response;
      authUserId = authResult.auth.authUserId;
    }

    if (action === 'full-sync') {
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'full-sync requires a user session' }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      const connection = await getConnectionForUser(supabaseAdmin, authUserId);
      const result = await handleFullSync(connection, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    if (action === 'incremental-sync') {
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'incremental-sync requires a user session' }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      const connection = await getConnectionForUser(supabaseAdmin, authUserId);
      const result = await handleIncrementalSync(connection, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    if (action === 'incremental-sync-all') {
      if (!isServiceRole) {
        return new Response(JSON.stringify({ error: 'incremental-sync-all requires service role' }), {
          status: 403,
          headers: corsHeaders,
        });
      }
      const connections = await getAllConnections(supabaseAdmin);
      const results = [];
      for (const connection of connections) {
        try {
          const result = await handleIncrementalSync(connection, supabaseAdmin);
          results.push({ userId: connection.user_id, success: true, ...result });
        } catch (error) {
          console.error('[dropbox-sync] incremental sync failed for', connection.user_id, error);
          results.push({
            userId: connection.user_id,
            success: false,
            error: 'Sync failed',
          });
        }
      }
      return new Response(JSON.stringify({ processed: results.length, results }), { headers: corsHeaders });
    }

    if (action === 'extract-text') {
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'extract-text requires a user session' }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      const connection = await getConnectionForUser(supabaseAdmin, authUserId);
      return await handleExtractText(connection, supabaseAdmin);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: full-sync, incremental-sync, incremental-sync-all, extract-text' }),
      { status: 400, headers: corsHeaders },
    );
  } catch (error) {
    return errorResponse('dropbox-sync', error, { corsHeaders });
  }
});
