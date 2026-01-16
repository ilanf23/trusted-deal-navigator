import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

// Known bot/scanner user agent patterns to filter out
const BOT_PATTERNS = [
  /googleimageproxy/i,
  /yahoo.*slurp/i,
  /bingpreview/i,
  /outlook/i,
  /microsoft office/i,
  /ms-office/i,
  /mozilla\/5\.0.*chrome\/4[0-5]\./i, // Very old Chrome versions (likely bots)
  /barracuda/i,
  /proofpoint/i,
  /mimecast/i,
  /fortiguard/i,
  /symantec/i,
  /mcafee/i,
  /sophos/i,
  /antivirus/i,
  /security/i,
  /scanner/i,
  /bot/i,
  /crawler/i,
  /spider/i,
  /fetch/i,
];

// Check if user agent looks like a bot/scanner
function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent) return true; // No user agent = suspicious
  
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  
  // Check for very old browser versions (likely scanners)
  const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
  if (chromeMatch && parseInt(chromeMatch[1]) < 70) {
    return true;
  }
  
  return false;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    // Expected paths:
    // /newsletter-track/open/:campaignId/:subscriberId
    // /newsletter-track/click/:campaignId/:subscriberId?url=...

    const action = pathParts[1]; // 'open' or 'click'
    const campaignId = pathParts[2];
    const subscriberId = pathParts[3];
    const userAgent = req.headers.get("user-agent");

    console.log(`newsletter-track: ${action} for campaign ${campaignId}, subscriber ${subscriberId}`);
    console.log(`newsletter-track: User-Agent: ${userAgent}`);

    if (!campaignId || !subscriberId) {
      console.error("newsletter-track: Missing campaignId or subscriberId");
      // Still return pixel/redirect to not break email display
      if (action === "open") {
        return new Response(TRACKING_PIXEL, {
          headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate" },
        });
      }
      return new Response("Missing parameters", { status: 400 });
    }

    // Check for bot/scanner user agents for open tracking
    if (action === "open" && isLikelyBot(userAgent)) {
      console.log(`newsletter-track: Ignoring open from likely bot: ${userAgent}`);
      return new Response(TRACKING_PIXEL, {
        headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "open") {
      // Track email open
      // Check if we already recorded an open for this subscriber
      const { data: existingOpen } = await supabase
        .from("newsletter_campaign_events")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("subscriber_id", subscriberId)
        .eq("event_type", "opened")
        .maybeSingle();

      if (!existingOpen) {
        // Record the open event
        const { error: insertError } = await supabase
          .from("newsletter_campaign_events")
          .insert({
            campaign_id: campaignId,
            subscriber_id: subscriberId,
            event_type: "opened",
            metadata: {
              user_agent: req.headers.get("user-agent"),
              timestamp: new Date().toISOString(),
            },
          });

        if (insertError) {
          console.error("newsletter-track: Error recording open:", insertError);
        } else {
          // Update campaign opened_count
          const { data: campaign } = await supabase
            .from("newsletter_campaigns")
            .select("opened_count")
            .eq("id", campaignId)
            .single();

          if (campaign) {
            const { error: updateError } = await supabase
              .from("newsletter_campaigns")
              .update({ opened_count: (campaign.opened_count || 0) + 1 })
              .eq("id", campaignId);

            if (updateError) {
              console.error("newsletter-track: Error updating opened_count:", updateError);
            } else {
              console.log(`newsletter-track: Updated opened_count for campaign ${campaignId}`);
            }
          }
        }
      } else {
        console.log("newsletter-track: Open already recorded for this subscriber");
      }

      // Return tracking pixel
      return new Response(TRACKING_PIXEL, {
        headers: { 
          "Content-Type": "image/gif", 
          "Cache-Control": "no-store, no-cache, must-revalidate",
          ...corsHeaders,
        },
      });

    } else if (action === "click") {
      // Track link click
      const targetUrl = url.searchParams.get("url");
      
      if (!targetUrl) {
        console.error("newsletter-track: Missing target URL for click");
        return new Response("Missing URL", { status: 400 });
      }

      // Record the click event
      const { error: insertError } = await supabase
        .from("newsletter_campaign_events")
        .insert({
          campaign_id: campaignId,
          subscriber_id: subscriberId,
          event_type: "clicked",
          metadata: {
            link: targetUrl,
            user_agent: req.headers.get("user-agent"),
            timestamp: new Date().toISOString(),
          },
        });

      if (insertError) {
        console.error("newsletter-track: Error recording click:", insertError);
      } else {
        // Check if this is the first click for this subscriber
        const { data: clickCount } = await supabase
          .from("newsletter_campaign_events")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("subscriber_id", subscriberId)
          .eq("event_type", "clicked");

        // Only increment campaign count for first click per subscriber
        if (clickCount && clickCount.length === 1) {
          const { data: campaign } = await supabase
            .from("newsletter_campaigns")
            .select("clicked_count")
            .eq("id", campaignId)
            .single();

          if (campaign) {
            const { error: updateError } = await supabase
              .from("newsletter_campaigns")
              .update({ clicked_count: (campaign.clicked_count || 0) + 1 })
              .eq("id", campaignId);

            if (updateError) {
              console.error("newsletter-track: Error updating clicked_count:", updateError);
            } else {
              console.log(`newsletter-track: Updated clicked_count for campaign ${campaignId}`);
            }
          }
        }
      }

      // Redirect to target URL
      return new Response(null, {
        status: 302,
        headers: { 
          "Location": targetUrl,
          ...corsHeaders,
        },
      });
    }

    return new Response("Unknown action", { status: 400 });

  } catch (error: any) {
    console.error("newsletter-track: Error:", error);
    // Return pixel anyway to not break email display
    return new Response(TRACKING_PIXEL, {
      headers: { "Content-Type": "image/gif" },
    });
  }
});
