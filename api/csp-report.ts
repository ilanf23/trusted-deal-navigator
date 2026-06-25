// Receives Content-Security-Policy violation reports and logs them.
//
// Wired up via the `report-uri` / `report-to` directives in the
// Content-Security-Policy-Report-Only header (see vercel.json). Reports are
// only logged to Vercel's runtime logs for review while CSP is staged in
// report-only mode — nothing is persisted and no secrets are touched.
//
// Runs on the Edge runtime so it stays cheap and uses only Web-standard APIs.

export const config = { runtime: 'edge' };

// CSP reports are tiny JSON blobs; reject anything larger to avoid abuse.
const MAX_BODY_BYTES = 16_384;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new Response('Payload Too Large', { status: 413 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (raw.length > MAX_BODY_BYTES) {
    return new Response('Payload Too Large', { status: 413 });
  }

  // Browsers send `{ "csp-report": {...} }` (report-uri) or an array of reports
  // (Reporting API). Keep the parsed value if possible, else log the raw text.
  let report: unknown = raw;
  try {
    report = JSON.parse(raw);
  } catch {
    // Not valid JSON — fall back to logging the raw string.
  }

  console.warn('[csp-report]', JSON.stringify(report));

  // Accept and discard. Never echo the input back to the client.
  return new Response(null, { status: 204 });
}
