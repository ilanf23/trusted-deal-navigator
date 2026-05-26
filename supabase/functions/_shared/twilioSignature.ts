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

/** Short fingerprint of a secret for log diagnostics — never logs the secret itself. */
async function fingerprint(secret: string): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // First 12 hex chars + length is enough to disambiguate which token is loaded
  // without enabling brute-force recovery.
  return `sha256:${hex.slice(0, 12)} (len=${secret.length})`;
}

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
  // Functions are reachable on TWO public hostnames:
  //   1. https://<ref>.supabase.co/functions/v1/<name>   (long form)
  //   2. https://<ref>.functions.supabase.co/<name>      (short form)
  // The internal router may rewrite paths between these forms before invoking
  // the function, so `req.url` is not authoritative about what Twilio signed.
  // We try every plausible combination of (proto, host, path-prefix) and accept
  // the first whose HMAC matches the X-Twilio-Signature header. Each candidate
  // is still a real URL the request could have been issued against, so an
  // attacker cannot widen the verification surface without forging a signature.
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
  const search = reqUrl.search ?? '';
  const reqPath = reqUrl.pathname;

  // Derive both path variants. Supabase's edge router accepts the function at
  // either /functions/v1/<name> (long) or /<name> (short, on the
  // *.functions.supabase.co host). Build both regardless of which one we
  // actually received, because Twilio may have been pointed at either URL.
  const pathVariants = new Set<string>([reqPath]);
  const fnPrefix = '/functions/v1/';
  if (reqPath.startsWith(fnPrefix)) {
    pathVariants.add('/' + reqPath.slice(fnPrefix.length));
  } else if (reqPath.startsWith('/')) {
    pathVariants.add(fnPrefix + reqPath.slice(1));
  }

  // Derive both host variants. If we see one form, also try the other —
  // <ref>.supabase.co ↔ <ref>.functions.supabase.co.
  const hostVariants = new Set<string>();
  const addHostVariants = (host: string | null | undefined) => {
    if (!host) return;
    hostVariants.add(host);
    const m = host.match(/^([^.]+)\.functions\.supabase\.co$/);
    if (m) hostVariants.add(`${m[1]}.supabase.co`);
    const m2 = host.match(/^([^.]+)\.supabase\.co$/);
    if (m2) hostVariants.add(`${m2[1]}.functions.supabase.co`);
  };
  addHostVariants(reqUrl.host);
  addHostVariants(fwdHost);
  addHostVariants(hostHeader);

  // Build the cartesian product of {proto} × {host} × {path}.
  const protoVariants = ['https', fwdProto].filter(Boolean) as string[];
  const candidateSet = new Set<string>();
  candidateSet.add(req.url); // Always try the raw req.url first.
  for (const proto of protoVariants) {
    for (const host of hostVariants) {
      for (const path of pathVariants) {
        candidateSet.add(`${proto}://${host}${path}${search}`);
      }
    }
  }
  const candidateUrls = Array.from(candidateSet);

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

  // All candidates failed. Log enough diagnostic context to figure out what
  // Twilio actually signed (the public URL it sent the webhook to). We log
  // the auth-token fingerprint — NOT the token itself — so the operator can
  // verify whether the Supabase secret matches the Twilio Console "Auth Token"
  // shown under Account → API keys & tokens. The first candidate's computed
  // signature is logged so the operator can compare against the
  // X-Twilio-Signature header value in the Twilio webhook debugger.
  const firstCandidateSig = await (async () => {
    const canonical = buildCanonical(candidateUrls[0]);
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
    return btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  })();

  console.warn('[TWILIO_SIG] Invalid signature — none of the candidate URLs verified', JSON.stringify({
    received_signature: signature,
    computed_signature_for_first_candidate: firstCandidateSig,
    auth_token_fingerprint: await fingerprint(authToken),
    candidate_urls: candidateUrls,
    req_url: req.url,
    req_path: reqPath,
    forwarded_proto: fwdProto,
    forwarded_host: fwdHost,
    host_header: hostHeader,
    body_keys: sortedKeys,
    body_size_bytes: bodyText.length,
    hint: 'If auth_token_fingerprint does not match the Twilio Console Auth Token, the Supabase secret TWILIO_AUTH_TOKEN is stale. If it matches, check the webhook URL on the Twilio number — it must be reachable at one of candidate_urls.',
  }));

  return {
    ok: false,
    response: new Response(
      'Forbidden: Twilio signature verification failed. Check edge function logs for [TWILIO_SIG] diagnostics.',
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      },
    ),
  };
}
