import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

// Returns TwiML to place a caller into a named Conference room.
// Used by both the redirected inbound leg and the browser's outbound Device.connect().
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-conference', 300, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const url = new URL(req.url);
    const formData = await req.formData().catch(() => null);

    // Conference name can come from query param or POST form data
    let conference = url.searchParams.get('conference') || '';
    if (formData) {
      conference = formData.get('conference')?.toString() || conference;
    }

    if (!conference) {
      console.error('[twilio-conference] No conference name provided');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Conference room not specified.</Say>
</Response>`;
      return new Response(twiml, { headers: corsHeaders });
    }

    console.log(`[twilio-conference] Joining conference: ${conference}`);

    // startConferenceOnEnter=true, endConferenceOnExit=false for the first participant
    // beep=false for cleaner UX
    // waitUrl="" suppresses hold music so it's silent until both join
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" waitUrl="">${conference}</Conference>
  </Dial>
</Response>`;

    return new Response(twiml, { headers: corsHeaders });
  } catch (error) {
    console.error('[twilio-conference] Error:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
</Response>`;
    return new Response(twiml, { headers: corsHeaders });
  }
});
