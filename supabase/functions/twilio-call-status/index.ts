import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// This endpoint handles call status updates from Twilio
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
    const callStatus = formData?.get('CallStatus')?.toString() || '';
    const callDuration = formData?.get('CallDuration')?.toString() || '0';

    // Dial-specific fields (present for status callbacks from <Dial>)
    const dialCallStatus = formData?.get('DialCallStatus')?.toString() || '';
    const dialCallSid = formData?.get('DialCallSid')?.toString() || '';
    const dialCallDuration = formData?.get('DialCallDuration')?.toString() || '';

    console.log(
      `Call status update: CallSid=${callSid} CallStatus=${callStatus} CallDuration=${callDuration}s DialCallStatus=${dialCallStatus} DialCallSid=${dialCallSid} DialCallDuration=${dialCallDuration}s`
    );

    if (!callSid) {
      return new Response('Missing CallSid', { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Prefer DialCallStatus if present (it describes the <Dial> leg result)
    const effectiveStatus = dialCallStatus || callStatus;

    // Update the active call status
    const updateData: Record<string, unknown> = {
      status: effectiveStatus,
    };

    if (effectiveStatus === 'in-progress') {
      updateData.answered_at = new Date().toISOString();
    }

    if (['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled'].includes(effectiveStatus)) {
      updateData.ended_at = new Date().toISOString();

      // Also log to evan_communications
      const { data: activeCall } = await supabase
        .from('active_calls')
        .select('*')
        .eq('call_sid', callSid)
        .single();

      if (activeCall) {
        await supabase
          .from('evan_communications')
          .insert({
            lead_id: activeCall.lead_id,
            communication_type: 'call',
            direction: activeCall.direction,
            phone_number: activeCall.from_number,
            duration_seconds: parseInt(callDuration) || null,
            status: callStatus,
            content: `${activeCall.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call - ${callStatus}`,
            call_sid: callSid,
          });
        console.log('Communication logged with call_sid');
      }
    }

    const { error } = await supabase
      .from('active_calls')
      .update(updateData)
      .eq('call_sid', callSid);

    if (error) {
      console.error('Error updating call status:', error);
    }

    return new Response('OK', { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });

  } catch (error) {
    console.error('Error in twilio-call-status function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
