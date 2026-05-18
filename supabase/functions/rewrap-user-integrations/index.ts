import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import {
  bytesToPgBytea,
  getKekForVersion,
  parseHexKey,
  unwrapDEK,
  wrapDEK,
} from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RewrapBody {
  from_version: number;
  to_version: number;
  batch_size?: number;
  dry_run?: boolean;
}

interface RewrapResult {
  scanned: number;
  rewrapped: number;
  failed: number;
  dry_run: boolean;
  remaining_on_from_version: number;
}

const DEFAULT_BATCH = 200;
const MAX_BATCH = 1000;

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

  const rateLimitResponse = await enforceRateLimit(req, 'rewrap-user-integrations', 5, 60);
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

    const body = (await req.json()) as RewrapBody;
    const fromVersion = Number(body.from_version);
    const toVersion = Number(body.to_version);
    const batchSize = Math.min(Math.max(1, Number(body.batch_size ?? DEFAULT_BATCH)), MAX_BATCH);
    const dryRun = body.dry_run === true;

    if (!Number.isInteger(fromVersion) || !Number.isInteger(toVersion) || fromVersion === toVersion) {
      return new Response(JSON.stringify({
        error: 'from_version and to_version must be distinct integers',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let fromKek: Uint8Array;
    let toKek: Uint8Array;
    try {
      fromKek = parseHexKey(getKekForVersion(fromVersion));
      toKek = parseHexKey(getKekForVersion(toVersion));
    } catch (err) {
      return new Response(JSON.stringify({
        error: err instanceof Error ? err.message : 'KEK lookup failed',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: rows, error: selectError } = await supabase
      .from('user_integrations')
      .select('id, encrypted_dek, dek_iv, dek_auth_tag, key_version')
      .eq('key_version', fromVersion)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (selectError) {
      return new Response(JSON.stringify({ error: 'Failed to read integrations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: RewrapResult = {
      scanned: rows?.length ?? 0,
      rewrapped: 0,
      failed: 0,
      dry_run: dryRun,
      remaining_on_from_version: 0,
    };

    for (const row of rows ?? []) {
      try {
        const dek = await unwrapDEK({
          encrypted_dek: row.encrypted_dek as unknown as string,
          dek_iv: row.dek_iv as unknown as string,
          dek_auth_tag: row.dek_auth_tag as unknown as string,
        }, fromKek);

        const wrapped = await wrapDEK(dek, toKek);

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('user_integrations')
            .update({
              encrypted_dek: wrapped.encrypted_dek,
              dek_iv: wrapped.dek_iv,
              dek_auth_tag: wrapped.dek_auth_tag,
              key_version: toVersion,
            })
            .eq('id', row.id)
            .eq('key_version', fromVersion);

          if (updateError) {
            result.failed += 1;
            continue;
          }
        }

        result.rewrapped += 1;
      } catch {
        result.failed += 1;
      }
    }

    const { count } = await supabase
      .from('user_integrations')
      .select('id', { count: 'exact', head: true })
      .eq('key_version', fromVersion);
    result.remaining_on_from_version = count ?? 0;

    return new Response(JSON.stringify(result), {
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
