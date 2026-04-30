import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  getValidAccessToken,
  sendMessage,
  modifyMessage,
  trashMessage,
  encodeBase64Url,
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

  const rateLimitResponse = await enforceRateLimit(req, 'gmail-write', 60, 60);
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

    if (action === 'send') {
      const body = await req.json();
      const flowId = body.flowId || `flow_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      console.log(`[${flowId}] Send request received:`, {
        to: body.to,
        subject: body.subject,
        bodyHtmlLength: body.body?.length || 0,
        bodyPlainLength: body.bodyPlain?.length || 0,
        bodyPreview: (body.body || body.bodyPlain || '').substring(0, 200),
        threadId: body.threadId || null,
        inReplyTo: body.inReplyTo || null,
        hasAttachments: !!body.attachments?.length,
        leadId: body.leadId || null,
      });

      const bodyContent = body.body || body.bodyPlain || '';
      if (!bodyContent || bodyContent.trim() === '') {
        console.error(`[${flowId}] HARD FAIL - Empty body detected`);
        return new Response(
          JSON.stringify({
            error: `Move Forward failed: email body was empty. See flow_id: ${flowId}`,
            flowId,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      try {
        const result = await sendMessage(
          accessToken,
          body.to,
          body.subject,
          bodyContent,
          body.threadId,
          body.inReplyTo,
          body.attachments,
          flowId,
        );

        console.log(`[${flowId}] Send complete:`, {
          messageId: result.id,
          threadId: result.threadId,
          verified: result.verified,
          verificationDetails: result.verificationDetails,
        });

        if (body.leadId) {
          try {
            const { error: commError } = await supabaseAdmin
              .from('communications')
              .insert({
                lead_id: body.leadId,
                communication_type: 'email',
                direction: 'outbound',
                content: `Subject: ${body.subject}\n\n${bodyContent.substring(0, 500)}...`,
                status: 'sent',
              });

            if (commError) {
              console.error(`[${flowId}] Failed to log email communication:`, commError);
            } else {
              console.log(`[${flowId}] Email logged as communication for lead ${body.leadId}`);
            }

            const { error: leadError } = await supabaseAdmin
              .from('people')
              .update({ last_activity_at: new Date().toISOString() })
              .eq('id', body.leadId);

            if (leadError) {
              console.error(`[${flowId}] Failed to update lead last_activity_at:`, leadError);
            }
          } catch (logErr) {
            console.error(`[${flowId}] Error logging email touchpoint:`, logErr);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          id: result.id,
          threadId: result.threadId,
          flowId,
          verified: result.verified,
          verificationDetails: result.verificationDetails,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (sendErr: any) {
        console.error(`[${flowId}] Send failed:`, sendErr.message);
        return new Response(
          JSON.stringify({
            error: sendErr.message,
            flowId,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    if (action === 'archive') {
      const body = await req.json();
      await modifyMessage(accessToken, body.messageId, [], ['INBOX']);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'trash') {
      const body = await req.json();
      await trashMessage(accessToken, body.messageId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'mark-read') {
      const body = await req.json();
      const removeLabels = body.read ? ['UNREAD'] : [];
      const addLabels = body.read ? [] : ['UNREAD'];
      await modifyMessage(accessToken, body.messageId, addLabels, removeLabels);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create-draft') {
      const body = await req.json();
      const { to, subject, body: emailBody } = body;

      if (!to || !subject || !emailBody) {
        return new Response(JSON.stringify({ error: 'Missing to, subject, or body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        emailBody,
      ].join('\r\n');

      const encodedEmail = encodeBase64Url(email);

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: { raw: encodedEmail },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Create draft error:', error);
        throw new Error('Failed to create draft');
      }

      const result = await response.json();
      return new Response(JSON.stringify({ success: true, id: result.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('gmail-write error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
