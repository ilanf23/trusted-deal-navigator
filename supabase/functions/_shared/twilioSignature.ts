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

  // Twilio signs the EXACT URL configured in the Twilio Console. Supabase Edge
  // Functions sit behind a TLS-terminating proxy, so `req.url` can show
  // `http://` even though the inbound request was `https://`, and the host
  // segment can be the internal pop hostname rather than the public
  // `<project>.supabase.co` domain. Either of those produces a canonical URL
  // mismatch and a false 403. To be robust without weakening the security
  // check, build a list of plausible candidates and accept the first one
  // whose HMAC matches the X-Twilio-Signature header. Each candidate is still
  // a real URL the request could have been issued against, so an attacker
  // can't widen the verification surface without also forging a signature.
  const sortedKeys = [...new Set([...params.keys()])].sort();
  const buildCanonical = (url: string): string => {
    let c = url;
    for (const key of sortedKeys) {
      for (const value of params.getAll(key)) {
        c += key + value;
      }
    }
    return c;
  };

  const reqUrl = new URL(req.url);
  const fwdProto = req.headers.get('x-forwarded-proto');
  const fwdHost = req.headers.get('x-forwarded-host');
  const hostHeader = req.headers.get('host');
  const path = reqUrl.pathname + (reqUrl.search ?? '');

  const candidateUrls = Array.from(
    new Set([
      req.url,
      // Force https on req.url's host (handles the TLS-termination case).
      `https://${reqUrl.host}${path}`,
      // Use the forwarded host if present (handles internal vs public hostname).
      fwdHost ? `https://${fwdHost}${path}` : null,
      // Fall back to the Host header.
      hostHeader ? `https://${hostHeader}${path}` : null,
      // And the forwarded-proto-honest variant (handles configs that route to
      // http for some reason — rare, but cheap to check).
      fwdProto && fwdHost ? `${fwdProto}://${fwdHost}${path}` : null,
    ].filter(Boolean) as string[]),
  );

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  for (const candidate of candidateUrls) {
    const canonical = buildCanonical(candidate);
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
    if (constantTimeEquals(expected, signature)) {
      return { ok: true, params };
    }
  }

  // All candidates failed. Log enough diagnostic context to identify what
  // Twilio was signing (the public URL it sent the webhook to) so we can
  // narrow the canonical reconstruction in a follow-up.
  console.warn('[TWILIO_SIG] Invalid signature', JSON.stringify({
    received_signature: signature,
    candidate_urls: candidateUrls,
    forwarded_proto: fwdProto,
    forwarded_host: fwdHost,
    host_header: hostHeader,
    req_url: req.url,
  }));

  return {
    ok: false,
    response: new Response('Forbidden', {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    }),
  };
}
