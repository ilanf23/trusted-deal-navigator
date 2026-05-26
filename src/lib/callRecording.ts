import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch a Twilio call recording through the authenticated proxy and return a
 * blob URL safe to drop into <audio src=...>. The Twilio URL itself is never
 * exposed to the browser; the proxy enforces an authenticated session.
 *
 * Callers are responsible for revoking the returned URL when the audio
 * element unmounts (URL.revokeObjectURL) — otherwise the blob leaks for the
 * lifetime of the tab.
 */
export async function fetchCallRecordingBlobUrl(communicationId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!projectUrl) throw new Error('VITE_SUPABASE_URL not configured');
  const endpoint =
    `${projectUrl.replace(/\/$/, '')}/functions/v1/call-recording-audio` +
    `?communicationId=${encodeURIComponent(communicationId)}`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Recording fetch failed (${res.status}): ${text || res.statusText}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
