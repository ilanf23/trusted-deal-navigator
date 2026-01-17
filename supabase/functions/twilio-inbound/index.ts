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

    // Generate TwiML to connect to the Twilio Client
    // This will ring all connected clients with the identity pattern 'evan-*'
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Client>evan-client</Client>
  </Dial>
</Response>`;

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
