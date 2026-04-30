import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function main() {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const partners = [
    { email: 'marcus.rivera@partnertest.com', password: 'PartnerTest123!', name: 'Marcus Rivera', company: 'Rivera Capital Advisors' },
    { email: 'sarah.kim@partnertest.com', password: 'PartnerTest123!', name: 'Sarah Kim', company: 'Kim & Associates Realty' },
    { email: 'david.thornton@partnertest.com', password: 'PartnerTest123!', name: 'David Thornton', company: 'Thornton Financial Group' },
    { email: 'angela.brooks@partnertest.com', password: 'PartnerTest123!', name: 'Angela Brooks', company: 'Brooks Commercial Lending' },
    { email: 'robert.chen@partnertest.com', password: 'PartnerTest123!', name: 'Robert Chen', company: 'Chen Pacific Ventures' },
  ]

  const { data: leads, error: leadsError } = await supabaseAdmin
    .from('potential')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(20)

  if (leadsError || !leads?.length) {
    console.error('No leads found to link', leadsError)
    Deno.exit(1)
  }

  const shuffled = [...leads].sort(() => Math.random() - 0.5)
  let leadIndex = 0

  const results: Array<{ email: string; status: string; userId?: string; error?: string }> = []

  for (const partner of partners) {
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const exists = existingUsers?.users?.find(u => u.email === partner.email)

    let userId: string

    if (exists) {
      userId = exists.id
      results.push({ email: partner.email, status: 'already exists', userId })
    } else {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: partner.email,
        password: partner.password,
        email_confirm: true,
      })

      if (userError) {
        results.push({ email: partner.email, status: 'error', error: userError.message })
        continue
      }

      userId = userData.user.id
      results.push({ email: partner.email, status: 'created', userId })
    }

    await supabaseAdmin.from('users').update({
      company_name: partner.company,
      contact_person: partner.name,
    }).eq('user_id', userId)

    await supabaseAdmin
      .from('users')
      .update({ app_role: 'partner' })
      .eq('user_id', userId)

    const numLeads = Math.random() > 0.5 ? 2 : 1
    for (let i = 0; i < numLeads; i++) {
      const lead = shuffled[leadIndex % shuffled.length]
      leadIndex++

      const { data: existingRef } = await supabaseAdmin
        .from('partner_referrals')
        .select('id')
        .eq('partner_id', userId)
        .eq('lead_id', lead.id)
        .maybeSingle()

      if (!existingRef) {
        await supabaseAdmin.from('partner_referrals').insert({
          partner_id: userId,
          lead_id: lead.id,
          name: lead.name,
          status: 'submitted',
        })
      }
    }
  }

  console.log(JSON.stringify({
    success: true,
    partners: results,
    leadsUsed: shuffled.slice(0, leadIndex).map(l => l.name),
  }, null, 2))
}

try {
  await main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error('Error:', message)
  Deno.exit(1)
}
