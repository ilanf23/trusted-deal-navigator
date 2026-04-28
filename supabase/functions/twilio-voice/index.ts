import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

// This endpoint handles TwiML for outbound calls and conference joins
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-voice', 300, 60);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Handle conference: prefix — browser joining a conference bridge
    if (toNumber.startsWith('conference:')) {
      const conferenceName = toNumber.replace('conference:', '');
      console.log(`[twilio-voice] Browser joining conference: ${conferenceName}`);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" waitUrl="">${conferenceName}</Conference>
  </Dial>
</Response>`;
      return new Response(twiml, { headers: corsHeaders });
    }

    // Handle client: prefix for browser-to-browser connections
    if (toNumber.startsWith('client:')) {
      const clientIdentity = toNumber.replace('client:', '');
      console.log(`Dialing Twilio Client: ${clientIdentity}`);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioPhoneNumber}" timeout="30">
    <Client>${clientIdentity}</Client>
  </Dial>
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

    // Generate TwiML to dial the number with recording, transcription, and a
    // per-Number statusCallback so call history is finalized server-side even
    // if the browser tab closes before the client-side disconnect handler runs.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioPhoneNumber}" record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" transcribe="true" transcribeCallback="${transcriptionCallbackUrl}">
    <Number statusCallback="${statusCallbackUrl}" statusCallbackEvent="completed" statusCallbackMethod="POST">${formattedPhone}</Number>
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
