import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  getValidAccessToken,
  listMessages,
  getMessage,
  modifyMessage,
  getLabels,
} from '../_shared/gmail/api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'gmail-mailbox', 120, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    const userId = authResult.auth.authUserId;

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabaseAdmin, userId);
    } catch {
      return new Response(JSON.stringify({ error: 'Gmail not connected', needsAuth: true }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'list') {
      const query = url.searchParams.get('q') || '';
      const maxResults = parseInt(url.searchParams.get('maxResults') || '50');
      const pageToken = url.searchParams.get('pageToken') || undefined;
      const fetchPhotos = url.searchParams.get('fetchPhotos') === 'true';

      const messagesData = await listMessages(accessToken, query, maxResults, pageToken);

      const BATCH_SIZE = 20;
      const messageIds = (messagesData.messages || []).map((m: any) => m.id);
      const messages: any[] = [];
      let droppedCount = 0;

      for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
        const batchIds = messageIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batchIds.map((id: string) => getMessage(accessToken, id, fetchPhotos)),
        );
        const validResults = batchResults.filter((m): m is NonNullable<typeof m> => m !== null);
        droppedCount += batchResults.length - validResults.length;
        messages.push(...validResults);

        if (i + BATCH_SIZE < messageIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (droppedCount > 0) {
        console.warn(`[gmail-mailbox] Dropped ${droppedCount} messages that failed to fetch individually out of ${messageIds.length} total`);
      }

      return new Response(JSON.stringify({
        messages,
        nextPageToken: messagesData.nextPageToken,
        resultSizeEstimate: messagesData.resultSizeEstimate || messages.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get') {
      const messageId = url.searchParams.get('id');
      if (!messageId) {
        return new Response(JSON.stringify({ error: 'Message ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const message = await getMessage(accessToken, messageId);

      if (message?.isUnread) {
        await modifyMessage(accessToken, messageId, [], ['UNREAD']);
      }

      return new Response(JSON.stringify(message), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-attachment') {
      const messageId = url.searchParams.get('messageId');
      const attachmentId = url.searchParams.get('attachmentId');
      if (!messageId || !attachmentId) {
        return new Response(JSON.stringify({ error: 'messageId and attachmentId are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Gmail API error (get-attachment):', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch attachment' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify({ data: data.data, size: data.size }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-drafts-count') {
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=500',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Gmail API error (list-drafts):', error);
        throw new Error('Failed to fetch drafts');
      }

      const data = await response.json();
      const draftsCount = data.drafts?.length || 0;

      return new Response(JSON.stringify({
        count: draftsCount,
        resultSizeEstimate: data.resultSizeEstimate || draftsCount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'labels') {
      const labels = await getLabels(accessToken);
      return new Response(JSON.stringify(labels), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('gmail-mailbox error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
