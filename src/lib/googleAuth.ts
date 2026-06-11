import { supabase } from '@/integrations/supabase/client';

export type GoogleIntegration = 'sheets' | 'calendar' | 'gmail';

export interface GoogleIntegrationStatus {
  connected: boolean;
  email?: string;
  calendarId?: string;
  connectedAt?: string;
  needsReauth?: boolean;
  capabilities?: Record<GoogleIntegration, boolean>;
}

export async function getGoogleIntegrationStatus(
  integration: GoogleIntegration,
): Promise<GoogleIntegrationStatus> {
  const { data, error } = await supabase.functions.invoke('google-auth', {
    body: { action: 'getStatus', integration },
  });
  if (error) throw error;
  return data as GoogleIntegrationStatus;
}

export function getGoogleOAuthErrorMessage(
  error: string,
  description?: string | null,
): string {
  if (description) return description;

  switch (error) {
    case 'access_denied':
      return 'Google denied access. If the app is in testing, ask an administrator to add this Google account as a test user.';
    case 'redirect_uri_mismatch':
      return 'This callback URL is not authorized in Google Cloud.';
    case 'invalid_scope':
      return 'Google rejected one or more requested permissions.';
    default:
      return `Google authorization failed: ${error}`;
  }
}
