import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { constantTimeEquals } from '../_shared/timingSafeEqual.ts';

const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimited = await enforceRateLimit(req, 'dropbox-webhook', 300, 60);
  if (rateLimited) return rateLimited;

  // GET: Dropbox webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const challenge = url.searchParams.get('challenge');
    if (challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' },
      });
    }
    return new Response('Missing challenge', { status: 400 });
  }

  // POST: Dropbox change notification
  if (req.method === 'POST') {
    try {
      const body = await req.text();

      // Verify HMAC-SHA256 signature
      const signature = req.headers.get('X-Dropbox-Signature');
      if (!signature) {
        console.error('Missing X-Dropbox-Signature header');
        return new Response('Missing signature', { status: 403 });
      }

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(DROPBOX_APP_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const expectedSignature = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (!constantTimeEquals(signature, expectedSignature)) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 403 });
      }

      // Trigger incremental sync (fire-and-forget)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // Fire and forget - don't await
      fetch(`${supabaseUrl}/functions/v1/dropbox-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'incremental-sync' }),
      }).catch(err => console.error('Failed to trigger sync:', err));

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
