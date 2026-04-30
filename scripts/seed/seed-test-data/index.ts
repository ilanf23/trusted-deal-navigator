import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function main() {
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

  const createdUsers: Array<{ email: string; status: string; userId?: string; error?: string }> = []

  for (const client of testClients) {
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const exists = existingUsers?.users?.find(u => u.email === client.email)

    if (exists) {
      createdUsers.push({ email: client.email, status: 'already exists', userId: exists.id })
      continue
    }

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

    await supabaseAdmin.from('users').update({
      company_name: client.company,
      contact_person: client.name,
    }).eq('user_id', userId)

    const { data: convo } = await supabaseAdmin.from('conversations').insert({
      client_id: userId,
      subject: `Inquiry from ${client.name}`,
    }).select().single()

    if (convo) {
      const messages = [
        { conversation_id: convo.id, sender_id: userId, content: `Hello, I'm interested in learning more about your commercial lending services.` },
        { conversation_id: convo.id, sender_id: userId, content: `We're looking to expand our business and need financing options.` },
      ]

      await supabaseAdmin.from('messages').insert(messages)
    }

    createdUsers.push({ email: client.email, status: 'created', userId })
  }

  console.log(JSON.stringify({ success: true, clients: createdUsers }, null, 2))
}

try {
  await main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error('Error:', message)
  Deno.exit(1)
}
