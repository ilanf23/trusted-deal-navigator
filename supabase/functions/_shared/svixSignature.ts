// Verifies Svix-style webhook signatures (used by Resend, Clerk, Loops, etc.).
// Algorithm: HMAC-SHA256(decodedSecret, `${svix-id}.${svix-timestamp}.${rawBody}`), base64.
// https://docs.svix.com/receiving/verifying-payloads/how-manual
//
// Consumes the request body. Returns either:
//   - { ok: true,  rawBody: string }      on valid signature
//   - { ok: false, response: Response }   with the response the caller should return as-is
//
// Caller must use the returned `rawBody` instead of calling req.json()/req.text() again.

export type SvixVerifyResult =
  | { ok: true; rawBody: string }
  | { ok: false; response: Response };

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export async function verifySvixSignature(
  req: Request,
  secretEnvVar: string,
  corsHeaders: Record<string, string>,
): Promise<SvixVerifyResult> {
  const secret = Deno.env.get(secretEnvVar);
  if (!secret) {
    console.error(`[SVIX_SIG] ${secretEnvVar} not configured`);
    return {
      ok: false,
      response: new Response("Server misconfigured", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }),
    };
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[SVIX_SIG] Missing signature headers");
    return {
      ok: false,
      response: new Response("Missing signature headers", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }),
    };
  }

  const tsSeconds = Number.parseInt(svixTimestamp, 10);
  if (!Number.isFinite(tsSeconds)) {
    console.warn("[SVIX_SIG] Invalid svix-timestamp header");
    return {
      ok: false,
      response: new Response("Invalid timestamp", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }),
    };
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    console.warn("[SVIX_SIG] Timestamp out of tolerance");
    return {
      ok: false,
      response: new Response("Timestamp out of tolerance", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }),
    };
  }

  const rawBody = await req.text();

  const secretB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let secretBytes: Uint8Array;
  try {
    secretBytes = base64Decode(secretB64);
  } catch (err) {
    console.error("[SVIX_SIG] Failed to decode signing secret:", err);
    return {
      ok: false,
      response: new Response("Server misconfigured", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }),
    };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

  const candidates = svixSignature
    .split(" ")
    .map((entry) => {
      const commaIdx = entry.indexOf(",");
      if (commaIdx === -1) return null;
      const version = entry.slice(0, commaIdx);
      const sig = entry.slice(commaIdx + 1);
      return version === "v1" ? sig : null;
    })
    .filter((s): s is string => s !== null);

  for (const candidate of candidates) {
    if (constantTimeEquals(expected, candidate)) {
      return { ok: true, rawBody };
    }
  }

  console.warn("[SVIX_SIG] Invalid signature");
  return {
    ok: false,
    response: new Response("Forbidden", {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    }),
  };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64Decode(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
