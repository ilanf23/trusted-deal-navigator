import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

// This endpoint handles TwiML for outbound calls
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const formData = await req.formData().catch(() => null);
    
    // Get the "To" number from the request
    let toNumber = url.searchParams.get('To') || '';
    if (formData) {
      toNumber = formData.get('To')?.toString() || toNumber;
    }

    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!toNumber) {
      console.log('No phone number provided');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No phone number was provided. Please try again.</Say>
</Response>`;
      return new Response(twiml, { headers: corsHeaders });
    }

    // Format phone number
    let formattedPhone = toNumber.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log(`Initiating call to ${formattedPhone} from ${twilioPhoneNumber}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const transcriptionCallbackUrl = `${supabaseUrl}/functions/v1/twilio-transcription`;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

    // Generate TwiML to dial the number with recording and transcription
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioPhoneNumber}" record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" transcribe="true" transcribeCallback="${transcriptionCallbackUrl}">
    <Number>${formattedPhone}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in twilio-voice function:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
</Response>`;
    return new Response(twiml, { headers: corsHeaders });
  }
});
