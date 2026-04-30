import { createClient } from '../_shared/supabase.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { requireAdmin } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const rateLimitResponse = await enforceRateLimit(req, 'manage-user-role', 3, 60)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders })
    if (!authResult.ok) return authResult.response

    const { auth } = authResult
    const callerId = auth.authUserId
    const callerRole = auth.teamMember?.app_role

    const { target_user_id, new_role } = await req.json()

    if (!target_user_id || !new_role) {
      return new Response(
        JSON.stringify({ error: 'target_user_id and new_role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validRoles = ['admin', 'super_admin', 'client', 'partner']
    if (!validRoles.includes(new_role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (target_user_id === callerId) {
      return new Response(
        JSON.stringify({ error: 'Cannot change your own role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: targetRow } = await supabaseAdmin
      .from('users')
      .select('app_role')
      .eq('user_id', target_user_id)
      .maybeSingle()

    if (!targetRow) {
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only super_admin may grant or revoke super_admin.
    const isSuperAdminOperation =
      new_role === 'super_admin' || targetRow.app_role === 'super_admin'

    if (isSuperAdminOperation && callerRole !== 'super_admin') {
      console.error(
        `manage-user-role: FORBIDDEN super_admin op - caller=${callerId} target=${target_user_id} ` +
        `target_role=${targetRow.app_role} new_role=${new_role}`
      )
      return new Response(
        JSON.stringify({ error: 'Only super_admin can grant or revoke super_admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ app_role: new_role })
      .eq('user_id', target_user_id)

    if (updateError) {
      console.error('Error updating role:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`manage-user-role: caller=${callerId} changed target=${target_user_id} to role=${new_role}`)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
