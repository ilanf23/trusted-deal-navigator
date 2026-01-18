import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

// This endpoint handles incoming calls from Twilio
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data from Twilio webhook
    const formData = await req.formData().catch(() => null);
    
    const callSid = formData?.get('CallSid')?.toString() || '';
    const fromNumber = formData?.get('From')?.toString() || '';
    const toNumber = formData?.get('To')?.toString() || '';
    const callStatus = formData?.get('CallStatus')?.toString() || 'ringing';

    console.log(`Incoming call: ${callSid} from ${fromNumber} to ${toNumber}, status: ${callStatus}`);

    if (!callSid || !fromNumber) {
      console.log('Missing required fields');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We are unable to process your call at this time. Please try again later.</Say>
</Response>`;
      return new Response(twiml, { headers: corsHeaders });
    }

    // Try to find a matching lead by phone number
    const normalizedPhone = fromNumber.replace(/\D/g, '').slice(-10);
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name')
      .or(`phone.ilike.%${normalizedPhone}%`)
      .limit(1)
      .single();

    // Insert the active call record
    const { error: insertError } = await supabase
      .from('active_calls')
      .upsert({
        call_sid: callSid,
        from_number: fromNumber,
        to_number: toNumber,
        status: 'ringing',
        direction: 'inbound',
        lead_id: lead?.id || null,
      }, {
        onConflict: 'call_sid',
      });

    if (insertError) {
      console.error('Error inserting active call:', insertError);
    } else {
      console.log('Active call record created/updated');
    }

    // Get admin users to find Twilio client identities
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    // Build client dial targets for all admin users
    let clientDialTargets = '';
    if (adminRoles && adminRoles.length > 0) {
      clientDialTargets = adminRoles
        .map(role => `<Client>evan-${role.user_id.substring(0, 8)}</Client>`)
        .join('\n    ');
    } else {
      // Fallback to a generic client identity
      clientDialTargets = '<Client>evan-admin</Client>';
    }

    console.log('Dialing Twilio clients:', clientDialTargets);

    // Generate TwiML to connect to all Twilio Client browsers
    // Note: transcribe attribute on <Dial> is deprecated - recordings are handled via recordingStatusCallback
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="60" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackEvent="completed">
    ${adminRoles && adminRoles.length > 0
      ? adminRoles
          .map(
            (role) => `<Client statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">
      <Identity>evan-${role.user_id.substring(0, 8)}</Identity>
    </Client>`
          )
          .join('\n    ')
      : `<Client statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">
      <Identity>evan-admin</Identity>
    </Client>`}
  </Dial>
</Response>`;

    console.log('TwiML response:', twiml);

    return new Response(twiml, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in twilio-inbound function:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
</Response>`;
    return new Response(twiml, { headers: corsHeaders });
  }
});
