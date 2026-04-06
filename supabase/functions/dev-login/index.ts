import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Safety gate — disable in production by not setting this env var
  if (Deno.env.get('DEV_LOGIN_ENABLED') !== 'true') {
    return new Response(
      JSON.stringify({ error: 'Dev login is disabled' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAdmin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const body = await req.json()
    const { action } = body

    // Action: list — return all active users with auth accounts
    if (action === 'list') {
      const rateLimitResponse = await enforceRateLimit(req, 'dev-login-list', 10, 60)
      if (rateLimitResponse) return rateLimitResponse

      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, name, email, app_role, position, is_owner, avatar_url')
        .not('user_id', 'is', null)
        .eq('is_active', true)
        .order('is_owner', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })

      if (error) {
        console.error('dev-login: error fetching users', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ users: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: login — generate magic link token for instant login
    if (action === 'login') {
      const rateLimitResponse = await enforceRateLimit(req, 'dev-login-auth', 5, 60)
      if (rateLimitResponse) return rateLimitResponse

      const { email } = body

      if (!email) {
        return new Response(
          JSON.stringify({ error: 'email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })

      if (error) {
        console.error('dev-login: error generating link for', email, error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ token_hash: data.properties.hashed_token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "list" or "login".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('dev-login error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
