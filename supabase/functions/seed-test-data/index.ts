import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const rateLimitResponse = enforceRateLimit(req, 'seed-test-data', 3, 60)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const testClients = [
      { email: 'testclient1@example.com', password: 'testpass123', name: 'Test Client 1', company: 'Test Company Alpha' },
      { email: 'testclient2@example.com', password: 'testpass123', name: 'Test Client 2', company: 'Test Company Beta' },
      { email: 'testclient3@example.com', password: 'testpass123', name: 'Test Client 3', company: 'Test Company Gamma' },
    ]

    const createdUsers = []

    for (const client of testClients) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const exists = existingUsers?.users?.find(u => u.email === client.email)
      
      if (exists) {
        createdUsers.push({ email: client.email, status: 'already exists', userId: exists.id })
        continue
      }

      // Create user
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: client.email,
        password: client.password,
        email_confirm: true,
      })

      if (userError) {
        console.error('Error creating user:', userError)
        createdUsers.push({ email: client.email, status: 'error', error: userError.message })
        continue
      }

      const userId = userData.user.id

      // Update profile with company info
      await supabaseAdmin.from('profiles').update({
        company_name: client.company,
        contact_person: client.name,
      }).eq('user_id', userId)

      // Create a conversation for this client
      const { data: convo } = await supabaseAdmin.from('conversations').insert({
        client_id: userId,
        subject: `Inquiry from ${client.name}`,
      }).select().single()

      if (convo) {
        // Add sample messages
        const messages = [
          { conversation_id: convo.id, sender_id: userId, content: `Hello, I'm interested in learning more about your commercial lending services.` },
          { conversation_id: convo.id, sender_id: userId, content: `We're looking to expand our business and need financing options.` },
        ]

        await supabaseAdmin.from('messages').insert(messages)
      }

      createdUsers.push({ email: client.email, status: 'created', userId })
    }

    return new Response(
      JSON.stringify({ success: true, clients: createdUsers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
