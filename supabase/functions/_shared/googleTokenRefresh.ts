// Shared Google OAuth access-token refresh for sheets_connections rows.
// Proactively refreshes when the token has less than 5 minutes remaining.

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

export interface SheetsConnection {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

export async function getValidSheetsAccessToken(
  connection: SheetsConnection,
  supabase: any,
): Promise<string | null> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  try {
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
      console.error('Sheets token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from('sheets_connections')
      .update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return data.access_token;
  } catch (err) {
    console.error('Error refreshing sheets token:', err);
    return null;
  }
}
