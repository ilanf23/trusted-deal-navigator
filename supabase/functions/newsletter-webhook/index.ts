import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend webhook event types
interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: {
      link: string;
      timestamp: string;
    };
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("newsletter-webhook: Received webhook event");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event: ResendWebhookEvent = await req.json();
    console.log("newsletter-webhook: Event type:", event.type);
    console.log("newsletter-webhook: Email ID:", event.data.email_id);

    // Find the campaign event by resend_id
    const { data: existingEvent, error: findError } = await supabase
      .from("newsletter_campaign_events")
      .select("id, campaign_id, subscriber_id")
      .contains("metadata", { resend_id: event.data.email_id })
      .maybeSingle();

    if (findError) {
      console.error("newsletter-webhook: Error finding event:", findError);
    }

    if (!existingEvent) {
      console.log("newsletter-webhook: No matching campaign event found for email:", event.data.email_id);
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const campaignId = existingEvent.campaign_id;
    const subscriberId = existingEvent.subscriber_id;

    // Map Resend event types to our event types
    let eventType: string | null = null;
    let updateField: string | null = null;

    switch (event.type) {
      case "email.delivered":
        eventType = "delivered";
        updateField = "delivered_count";
        break;
      case "email.opened":
        eventType = "opened";
        updateField = "opened_count";
        break;
      case "email.clicked":
        eventType = "clicked";
        updateField = "clicked_count";
        break;
      case "email.bounced":
        eventType = "bounced";
        updateField = "bounced_count";
        break;
      case "email.complained":
        eventType = "complained";
        break;
      case "email.unsubscribed":
        eventType = "unsubscribed";
        updateField = "unsubscribed_count";
        break;
      default:
        console.log("newsletter-webhook: Unhandled event type:", event.type);
    }

    if (eventType) {
      // Check if we already recorded this event type for this subscriber
      const { data: existingEventType } = await supabase
        .from("newsletter_campaign_events")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("subscriber_id", subscriberId)
        .eq("event_type", eventType)
        .maybeSingle();

      // Only record unique events (don't count multiple opens from same person)
      if (!existingEventType) {
        // Record the event
        const { error: insertError } = await supabase
          .from("newsletter_campaign_events")
          .insert({
            campaign_id: campaignId,
            subscriber_id: subscriberId,
            event_type: eventType,
            metadata: {
              resend_id: event.data.email_id,
              timestamp: event.created_at,
              ...(event.data.click ? { link: event.data.click.link } : {}),
            },
          });

        if (insertError) {
          console.error("newsletter-webhook: Error inserting event:", insertError);
        } else {
          console.log(`newsletter-webhook: Recorded ${eventType} event for campaign ${campaignId}`);

          // Update campaign stats
          if (updateField) {
            const { data: campaign } = await supabase
              .from("newsletter_campaigns")
              .select(updateField)
              .eq("id", campaignId)
              .single();

            if (campaign) {
              const currentCount = (campaign as unknown as Record<string, number>)[updateField] || 0;
              const { error: updateError } = await supabase
                .from("newsletter_campaigns")
                .update({ [updateField]: currentCount + 1 })
                .eq("id", campaignId);

              if (updateError) {
                console.error("newsletter-webhook: Error updating campaign stats:", updateError);
              } else {
                console.log(`newsletter-webhook: Updated ${updateField} to ${currentCount + 1}`);
              }
            }
          }
        }
      } else {
        console.log(`newsletter-webhook: ${eventType} already recorded for this subscriber`);
      }
    }

    return new Response(JSON.stringify({ received: true, processed: eventType }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("newsletter-webhook: Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
