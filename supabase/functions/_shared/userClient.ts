// supabase/functions/_shared/userClient.ts
// Returns one user-scoped client (RLS enforced) and one service-role client
// (RLS bypassed). Edge functions should use the user client for ALL business
// data and the service client only for narrow privileged needs
// (key decryption, audit writes).
import { createClient, type SupabaseClient } from './supabase.ts';

export interface RequestClients {
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
  authHeader: string;
}

export function getRequestClients(req: Request): RequestClients {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) throw new Error('No authorization header');

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { userClient, serviceClient, authHeader };
}
