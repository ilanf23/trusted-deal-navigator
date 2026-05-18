import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { encryptSecret, getKekForVersion } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddIntegrationBody {
  target_user_id: string;
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

    const adminCheck = await requireAdmin(req, supabase, { corsHeaders });
    if (!adminCheck.ok) return adminCheck.response;

    const body = (await req.json()) as AddIntegrationBody;
    const targetUserId = (body.target_user_id ?? '').trim();
    const provider = normalizeProvider(body.provider ?? '');
    const label = (body.label ?? '').trim();
    const plaintext = (body.plaintext ?? '').trim();

    if (!targetUserId || !provider || !label || !plaintext) {
      return new Response(JSON.stringify({ error: 'target_user_id, provider, label, and plaintext are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetUser, error: targetErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle();
    if (targetErr || !targetUser) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyVersion = 1;
    const encrypted = await encryptSecret(plaintext, getKekForVersion(keyVersion), keyVersion);

    const { data, error } = await supabase
      .from('user_integrations')
      .insert({
        user_id: targetUserId,
        provider,
        label,
        ...encrypted,
      })
      .select('id, user_id, provider, label, created_at, last_used_at, revoked_at')
      .single();

    if (error) {
      const conflict = error.code === '23505';
      return new Response(JSON.stringify({
        error: conflict ? 'An integration with this provider and label already exists for that user' : 'Failed to add integration',
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
