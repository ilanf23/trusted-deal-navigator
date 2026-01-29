import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

// Generate unique flow ID for tracing
function generateFlowId(): string {
  return crypto.randomUUID();
}

// This endpoint handles incoming calls from Twilio
Deno.serve(async (req) => {
  const callFlowId = generateFlowId();
  const webhookTimestamp = new Date().toISOString();
  
  console.log(`[CALL_FLOW:${callFlowId}] Webhook received at ${webhookTimestamp}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData().catch(() => null);
    
    const callSid = formData?.get('CallSid')?.toString() || '';
    const fromNumber = formData?.get('From')?.toString() || '';
    const toNumber = formData?.get('To')?.toString() || '';
    const callStatus = formData?.get('CallStatus')?.toString() || 'ringing';

    console.log(`[CALL_FLOW:${callFlowId}] Call details - SID: ${callSid}, From: ${fromNumber}, Status: ${callStatus}`);

    // Log webhook received event
    await supabase.from('call_events').insert({
      call_flow_id: callFlowId,
      call_sid: callSid || 'unknown',
      event_type: 'webhook_received',
      from_number: fromNumber,
      to_number: toNumber,
      webhook_received: true,
      metadata: {
        call_status: callStatus,
        webhook_timestamp: webhookTimestamp,
        raw_params: Object.fromEntries(formData?.entries() || []),
      },
    });

    if (!callSid || !fromNumber) {
      console.log(`[CALL_FLOW:${callFlowId}] ERROR: Missing required fields`);
      
      await supabase.from('call_events').insert({
        call_flow_id: callFlowId,
        call_sid: callSid || 'unknown',
        event_type: 'error',
        metadata: { error: 'Missing required fields', from_number: fromNumber, call_sid: callSid },
      });
      
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

    console.log(`[CALL_FLOW:${callFlowId}] Lead lookup - Found: ${lead ? lead.name : 'No match'}`);

    // Insert the active call record with call_flow_id for tracing
    const { data: insertedCall, error: insertError } = await supabase
      .from('active_calls')
      .upsert({
        call_sid: callSid,
        from_number: fromNumber,
        to_number: toNumber,
        status: 'ringing',
        direction: 'inbound',
        lead_id: lead?.id || null,
        call_flow_id: callFlowId,
        webhook_timestamp: webhookTimestamp,
      }, {
        onConflict: 'call_sid',
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[CALL_FLOW:${callFlowId}] ERROR inserting active call:`, insertError);
      
      await supabase.from('call_events').insert({
        call_flow_id: callFlowId,
        call_sid: callSid,
        event_type: 'db_error',
        from_number: fromNumber,
        to_number: toNumber,
        db_inserted: false,
        metadata: { error: insertError.message },
      });
    } else {
      console.log(`[CALL_FLOW:${callFlowId}] Active call record created - ID: ${insertedCall?.id}`);
      
      // Log successful DB insert
      await supabase.from('call_events').insert({
        call_flow_id: callFlowId,
        call_sid: callSid,
        event_type: 'db_inserted',
        from_number: fromNumber,
        to_number: toNumber,
        lead_id: lead?.id,
        lead_name: lead?.name,
        webhook_received: true,
        db_inserted: true,
        realtime_sent: true, // Supabase realtime is automatic
        metadata: {
          active_call_id: insertedCall?.id,
          lead_found: !!lead,
        },
      });
    }

    // Get admin users to find Twilio client identities
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const clientCount = adminRoles?.length || 0;
    console.log(`[CALL_FLOW:${callFlowId}] Found ${clientCount} admin clients to dial`);

    // Build client dial targets for all admin users
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

    // Build the client targets with proper formatting
    const clientTargets = adminRoles && adminRoles.length > 0
      ? adminRoles
          .map(
            (role) => `    <Client statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">
      <Identity>evan-${role.user_id.substring(0, 8)}</Identity>
    </Client>`
          )
          .join('\n')
      : `    <Client statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">
      <Identity>evan-admin</Identity>
    </Client>`;

    // Log TwiML generation
    await supabase.from('call_events').insert({
      call_flow_id: callFlowId,
      call_sid: callSid,
      event_type: 'twiml_generated',
      from_number: fromNumber,
      to_number: toNumber,
      metadata: {
        client_count: clientCount,
        status_callback_url: statusCallbackUrl,
      },
    });

    // Include a fallback action if no one answers - this prevents instant hangup
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackEvent="completed" action="${statusCallbackUrl}">
${clientTargets}
  </Dial>
  <Say>We're sorry, no one is available to take your call right now. Please leave a message after the beep, or try again later.</Say>
  <Record maxLength="120" transcribe="false" recordingStatusCallback="${statusCallbackUrl}" />
  <Say>Thank you for your message. Goodbye.</Say>
</Response>`;

    console.log(`[CALL_FLOW:${callFlowId}] TwiML response generated, returning to Twilio`);

    return new Response(twiml, { headers: corsHeaders });

  } catch (error) {
    console.error(`[CALL_FLOW:${callFlowId}] CRITICAL ERROR in twilio-inbound:`, error);
    
    // Log the error
    await supabase.from('call_events').insert({
      call_flow_id: callFlowId,
      call_sid: 'unknown',
      event_type: 'critical_error',
      metadata: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
</Response>`;
    return new Response(twiml, { headers: corsHeaders });
  }
});
