import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// === DB-only Dropbox handlers (no Dropbox API token for some actions) ===

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

// === Server ===

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'dropbox-search', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body.action || new URL(req.url).searchParams.get('action');

    let result: any;
    switch (action) {
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
    console.error('dropbox-search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
