// Dropbox API helpers shared by dropbox-files, dropbox-mutations, dropbox-search edge functions.

const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')!;
const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')!;

export interface DropboxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function refreshDropboxToken(refreshToken: string): Promise<DropboxTokenResponse> {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Dropbox token refresh error:', error);
    throw new Error('Failed to refresh Dropbox token');
  }

  return response.json();
}

export function parseDropboxApiError(operation: string, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText);
    const requiredScope = parsed?.error?.required_scope;
    const errorTag = parsed?.error?.['.tag'];

    if (errorTag === 'missing_scope' && requiredScope) {
      return `Dropbox app is missing required scope: ${requiredScope}. Update Dropbox app permissions and reconnect Dropbox.`;
    }

    if (parsed?.error_summary) {
      return `Failed to ${operation}: ${parsed.error_summary}`;
    }
  } catch {
    // non-JSON error response
  }

  return `Failed to ${operation}`;
}

export async function getValidAccessToken(supabase: any): Promise<string> {
  const { data: connection, error } = await supabase
    .from('dropbox_connections')
    .select('*')
    .limit(1)
    .single();

  if (error || !connection) {
    throw new Error('Dropbox not connected');
  }

  const tokenExpiry = new Date(connection.token_expiry);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Refreshing Dropbox access token...');
    const tokens = await refreshDropboxToken(connection.refresh_token);

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('dropbox_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq('id', connection.id);

    return tokens.access_token;
  }

  return connection.access_token;
}

export function sanitizeDropboxPath(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim();
}
