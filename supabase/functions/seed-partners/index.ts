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

  const rateLimitResponse = await enforceRateLimit(req, 'seed-partners', 3, 60)
  if (rateLimitResponse) return rateLimitResponse

  try {
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

    // Fetch existing leads to link
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('potential')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(20)

    if (leadsError || !leads?.length) {
      return new Response(
        JSON.stringify({ error: 'No leads found to link', details: leadsError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Shuffle leads for random assignment
    const shuffled = [...leads].sort(() => Math.random() - 0.5)
    let leadIndex = 0

    const results = []

    for (const partner of partners) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const exists = existingUsers?.users?.find(u => u.email === partner.email)

      let userId: string

      if (exists) {
        userId = exists.id
        results.push({ email: partner.email, status: 'already exists', userId })
      } else {
        // Create auth user
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

      // Update profile
      await supabaseAdmin.from('users').update({
        company_name: partner.company,
        contact_person: partner.name,
      }).eq('user_id', userId)

      // Ensure partner role is set on team_members record
      await supabaseAdmin
        .from('users')
        .update({ app_role: 'partner' })
        .eq('user_id', userId)

      // Link to 1-2 random leads
      const numLeads = Math.random() > 0.5 ? 2 : 1
      for (let i = 0; i < numLeads; i++) {
        const lead = shuffled[leadIndex % shuffled.length]
        leadIndex++

        // Check if referral already exists
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

    return new Response(
      JSON.stringify({ success: true, partners: results, leadsUsed: shuffled.slice(0, leadIndex).map(l => l.name) }),
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
