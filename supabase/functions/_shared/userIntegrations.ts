import type { SupabaseClient } from './supabase.ts';
import { decryptSecret } from './crypto.ts';

export interface ResolvedUserIntegration {
  id: string;
  plaintext: string;
}

/**
 * Look up an active user_integrations row for (userId, provider), decrypt it,
 * and stamp last_used_at. Returns null when the user has no active integration
 * for this provider — callers should fall back to the system-wide env var.
 *
 * `userId` is the public.users.id (team-member id), not auth.users.id. This
 * matches the column on user_integrations and the team-member resolution in
 * _shared/auth.ts.
 */
export async function resolveUserIntegration(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
): Promise<ResolvedUserIntegration | null> {
  const { data, error } = await supabase
    .from('user_integrations')
    .select(
      'id, ciphertext, iv, auth_tag, encrypted_dek, dek_iv, dek_auth_tag, key_version',
    )
    .eq('user_id', userId)
    .eq('provider', provider.trim().toLowerCase())
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  let plaintext: string;
  try {
    plaintext = await decryptSecret(data);
  } catch {
    return null;
  }

  await supabase
    .from('user_integrations')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { id: data.id, plaintext };
}

/**
 * Convenience wrapper: return the user's key if present, otherwise the value
 * of the named env var. Returns null if neither exists.
 */
export async function getProviderKey(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  provider: string,
  fallbackEnvVar: string,
): Promise<string | null> {
  if (userId) {
    const userKey = await resolveUserIntegration(supabase, userId, provider);
    if (userKey) return userKey.plaintext;
  }
  return Deno.env.get(fallbackEnvVar) ?? null;
}
