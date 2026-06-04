import { createClient, type SupabaseClient } from './supabase.ts';

export interface ResolvedTeamMember {
  id: string;
  name: string | null;
  email: string | null;
  app_role: string | null;
  is_owner: boolean;
}

export interface ResolvedAuth {
  authUserId: string;
  authUserEmail: string | null;
  teamMember: ResolvedTeamMember | null;
  isOwner: boolean;
  isFounder: boolean;
}

export type RequireAdminResult =
  | { ok: true; auth: ResolvedAuth }
  | { ok: false; response: Response };

/**
 * Resolve the calling user from the request's Authorization header.
 *
 * Returns the auth.users id, the matching `users` row (the team member),
 * and a derived `isOwner` flag. Throws on missing/invalid auth so callers
 * can map to a 401 response.
 *
 * The caller is responsible for any further role checks (e.g. requireAdmin).
 */
export async function getUserFromRequest(
  req: Request,
  supabase: SupabaseClient,
): Promise<ResolvedAuth> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('No authorization header');

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');

  const { data: teamMember } = await supabase
    .from('users')
    .select('id, name, email, app_role, is_owner')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = teamMember?.app_role ?? null;
  const isOwner = role === 'admin' || role === 'super_admin';
  // Founder = authoritative is_owner column OR super_admin. Distinct from the
  // loose isOwner above, which (intentionally, for write flows) also treats
  // employee `admin`s as owners. Founder gates company-wide reads + raw SQL.
  const isFounder = teamMember?.is_owner === true || role === 'super_admin';

  return {
    authUserId: user.id,
    authUserEmail: user.email ?? null,
    teamMember: teamMember
      ? {
          id: teamMember.id,
          name: teamMember.name,
          email: teamMember.email,
          app_role: role,
          is_owner: isOwner,
        }
      : null,
    isOwner,
    isFounder,
  };
}

/**
 * Verify the request's caller is authenticated AND has admin/super_admin role.
 *
 * Returns a discriminated union so callers don't need try/catch:
 *   { ok: true, auth }                     — proceed with handler logic
 *   { ok: false, response: 401 | 403 }     — return immediately
 *
 * 401 → missing/invalid token.
 * 403 → token valid but `users.app_role` is neither 'admin' nor 'super_admin'.
 *
 * Pass `corsHeaders` so the error Response carries the same CORS headers as
 * the rest of the function. No caching — every call re-reads the role.
 */
export async function requireAdmin(
  req: Request,
  supabase: SupabaseClient,
  options?: { corsHeaders?: Record<string, string> },
): Promise<RequireAdminResult> {
  const corsHeaders = options?.corsHeaders ?? {};
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  let auth: ResolvedAuth;
  try {
    auth = await getUserFromRequest(req, supabase);
  } catch {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: jsonHeaders },
      ),
    };
  }

  if (!auth.isOwner) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: jsonHeaders },
      ),
    };
  }

  return { ok: true, auth };
}
