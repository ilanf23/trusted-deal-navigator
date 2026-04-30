// Verifies X-Twilio-Signature on Twilio webhook POSTs.
// Twilio algorithm: HMAC-SHA1(authToken, fullUrl + sortedConcatPostParams), base64.
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
//
// Consumes the request body. Returns either:
//   - { ok: true,  params: URLSearchParams }  on valid signature
//   - { ok: false, response: Response }       with the response the caller should return as-is
//
// Caller must use the returned `params` instead of calling req.formData() again.

import { constantTimeEquals } from './timingSafeEqual.ts';

export type TwilioVerifyResult =
  | { ok: true; params: URLSearchParams }
  | { ok: false; response: Response };

export async function verifyTwilioSignature(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<TwilioVerifyResult> {
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!authToken) {
    console.error('[TWILIO_SIG] TWILIO_AUTH_TOKEN not configured');
    return {
      ok: false,
      response: new Response('Server misconfigured', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      }),
    };
  }

  const signature = req.headers.get('x-twilio-signature');
  if (!signature) {
    console.warn('[TWILIO_SIG] Missing X-Twilio-Signature header');
    return {
      ok: false,
      response: new Response('Forbidden', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      }),
    };
  }

  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);

  const url = req.url;
  const sortedKeys = [...new Set([...params.keys()])].sort();
  let canonical = url;
  for (const key of sortedKeys) {
    for (const value of params.getAll(key)) {
      canonical += key + value;
    }
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

  if (!constantTimeEquals(expected, signature)) {
    console.warn('[TWILIO_SIG] Invalid signature');
    return {
      ok: false,
      response: new Response('Forbidden', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      }),
    };
  }

  return { ok: true, params };
}
