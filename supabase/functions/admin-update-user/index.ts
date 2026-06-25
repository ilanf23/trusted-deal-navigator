import { createClient } from '../_shared/supabase.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { requireAdmin } from '../_shared/auth.ts'
import { errorResponse } from '../_shared/responses.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const rateLimitResponse = await enforceRateLimit(req, 'admin-update-user', 3, 60)
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

    const { user_id, email, password } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!email && !password) {
      return new Response(
        JSON.stringify({ error: 'Nothing to update: provide email and/or password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up the target user to enforce founder-level protection before any write.
    const { data: targetRow, error: targetError } = await supabaseAdmin
      .from('users')
      .select('user_id, email, app_role, is_owner')
      .eq('user_id', user_id)
      .maybeSingle()

    if (targetError) {
      return errorResponse('admin-update-user', targetError, { corsHeaders, status: 400 })
    }

    if (!targetRow) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Founder-level targets (is_owner or super_admin) may only be modified by founders.
    const targetIsFounder = targetRow.is_owner === true || targetRow.app_role === 'super_admin'
    if (targetIsFounder && !auth.isFounder) {
      return new Response(
        JSON.stringify({ error: 'Only founders can update founder accounts.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const updateData: { email?: string; password?: string } = {}
    if (email) updateData.email = email
    if (password) updateData.password = password

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      updateData
    )

    if (error) {
      return errorResponse('admin-update-user', error, { corsHeaders, status: 400 })
    }

    if (email) {
      await supabaseAdmin
        .from('users')
        .update({ email })
        .eq('user_id', user_id)
    }

    return new Response(
      JSON.stringify({ success: true, user: data.user }),
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
