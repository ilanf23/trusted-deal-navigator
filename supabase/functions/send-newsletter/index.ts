import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNewsletterRequest {
  campaignId: string;
  recipientIds: string[];
  subject: string;
  content: string;
  fromName?: string;
}

interface Recipient {
  id: string;
  email: string;
  name: string | null;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("send-newsletter function invoked");

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      console.error("User is not admin");
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { campaignId, recipientIds, subject, content, fromName = "Commercial Lending X" }: SendNewsletterRequest = await req.json();

    console.log(`Sending newsletter campaign ${campaignId} to ${recipientIds.length} recipients`);

    if (!recipientIds || recipientIds.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients specified" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch recipient details from leads table
    const { data: recipients, error: recipientsError } = await supabase
      .from("leads")
      .select("id, email, name")
      .in("id", recipientIds)
      .not("email", "is", null);

    if (recipientsError) {
      console.error("Error fetching recipients:", recipientsError);
      return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const validRecipients: Recipient[] = recipients?.filter(r => r.email) || [];
    console.log(`Found ${validRecipients.length} valid recipients with emails`);

    if (validRecipients.length === 0) {
      return new Response(JSON.stringify({ error: "No valid recipients with email addresses" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Track results
    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Send emails to each recipient
    for (const recipient of validRecipients) {
      try {
        // Personalize content
        const personalizedContent = content
          .replace(/{{name}}/g, recipient.name || "Valued Client")
          .replace(/{{email}}/g, recipient.email);

        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
              .header { background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px 40px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
              .content { padding: 40px; }
              .content p { margin: 0 0 16px 0; }
              .footer { background: #f8f9fa; padding: 20px 40px; text-align: center; font-size: 12px; color: #666; }
              .footer a { color: #2d5a87; text-decoration: none; }
              .unsubscribe { margin-top: 10px; font-size: 11px; color: #999; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${fromName}</h1>
              </div>
              <div class="content">
                ${personalizedContent.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
                <p class="unsubscribe">
                  If you no longer wish to receive these emails, please contact us to unsubscribe.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Send email via Resend API
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${fromName} <newsletter@maverich.ai>`,
            to: [recipient.email],
            subject: subject,
            html: htmlContent,
          }),
        });

        const emailResult = await emailResponse.json();

        if (!emailResponse.ok || emailResult.error) {
          console.error(`Failed to send to ${recipient.email}:`, emailResult.error || emailResult);
          failedCount++;
          errors.push(`${recipient.email}: ${emailResult.error?.message || 'Unknown error'}`);
        } else {
          console.log(`Email sent to ${recipient.email}:`, emailResult.id);
          sentCount++;
          deliveredCount++;

          // Record the event
          await supabase.from("newsletter_campaign_events").insert({
            campaign_id: campaignId,
            subscriber_id: recipient.id,
            event_type: "sent",
            metadata: { resend_id: emailResult.id },
          });
        }
      } catch (error: any) {
        console.error(`Error sending to ${recipient.email}:`, error);
        failedCount++;
        errors.push(`${recipient.email}: ${error.message}`);
      }
    }

    // Update campaign stats
    const { error: updateError } = await supabase
      .from("newsletter_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipients_count: validRecipients.length,
        delivered_count: deliveredCount,
      })
      .eq("id", campaignId);

    if (updateError) {
      console.error("Error updating campaign:", updateError);
    }

    console.log(`Newsletter sent: ${sentCount} delivered, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-newsletter function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
