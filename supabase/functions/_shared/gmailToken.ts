import { createClient } from './supabase.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Gmail token: ${await response.text()}`);
  }

  return response.json();
}

/**
 * Resolve a valid Gmail access token for a specific user.
 *
 * Reads `gmail_connections` filtered by `user_id`, refreshes proactively
 * when the token expires within 5 minutes, and persists the new token.
 * Returns null when the user has no Gmail connection or the refresh fails.
 *
 * `userId` is the `users.id` of the team member whose Gmail account
 * should send/draft the message — never default to "the first row".
 */
export async function getGmailAccessTokenForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ accessToken: string; email: string } | null> {
  try {
    const { data: connection, error } = await supabase
      .from('gmail_connections')
      .select('access_token, email, refresh_token, token_expiry')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !connection) {
      return null;
    }

    const expiry = new Date(connection.token_expiry);
    const now = new Date();

    if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
      return { accessToken: connection.access_token, email: connection.email };
    }

    const tokens = await refreshAccessToken(connection.refresh_token);
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from('gmail_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry,
      })
      .eq('user_id', userId);

    return { accessToken: tokens.access_token, email: connection.email };
  } catch (err) {
    console.error('getGmailAccessTokenForUser error:', err);
    return null;
  }
}
