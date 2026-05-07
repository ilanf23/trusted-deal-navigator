import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { encryptSecret, getKekForVersion } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddIntegrationBody {
  provider: string;
  label: string;
  plaintext: string;
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'add-user-integration', 20, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let auth;
    try {
      auth = await getUserFromRequest(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!auth.teamMember?.id) {
      return new Response(JSON.stringify({ error: 'No workspace user found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as AddIntegrationBody;
    const provider = normalizeProvider(body.provider ?? '');
    const label = (body.label ?? '').trim();
    const plaintext = (body.plaintext ?? '').trim();

    if (!provider || !label || !plaintext) {
      return new Response(JSON.stringify({ error: 'provider, label, and plaintext are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyVersion = 1;
    const encrypted = await encryptSecret(plaintext, getKekForVersion(keyVersion), keyVersion);

    const { data, error } = await supabase
      .from('user_integrations')
      .insert({
        user_id: auth.teamMember.id,
        provider,
        label,
        ...encrypted,
      })
      .select('id, provider, label, created_at, last_used_at, revoked_at')
      .single();

    if (error) {
      const conflict = error.code === '23505';
      return new Response(JSON.stringify({
        error: conflict ? 'An integration with this provider and label already exists' : 'Failed to add integration',
      }), {
        status: conflict ? 409 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ integration: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
