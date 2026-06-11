import { type SupabaseClient } from './supabase.ts';
import {
  type GoogleIntegration,
  hasGoogleIntegrationScopes,
} from './googleOAuth.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string,
  integration?: GoogleIntegration,
): Promise<{ accessToken: string; email: string } | null> {
  try {
    const { data: connection, error } = await supabase
      .from('google_connections')
      .select('id, access_token, email, refresh_token, token_expiry, scopes, needs_reauth')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !connection) return null;
    if (
      connection.needs_reauth ||
      (integration && !hasGoogleIntegrationScopes(connection.scopes, integration))
    ) {
      return null;
    }

    const expiry = new Date(connection.token_expiry);
    const now = new Date();

    if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
      return { accessToken: connection.access_token, email: connection.email };
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Google token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from('google_connections')
      .update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return { accessToken: data.access_token, email: connection.email };
  } catch (err) {
    console.error('getValidGoogleAccessToken error:', err);
    return null;
  }
}
