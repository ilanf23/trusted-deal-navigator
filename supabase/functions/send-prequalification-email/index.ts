import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  leadId: string;
}

const generateToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId }: SendEmailRequest = await req.json();
    
    if (!leadId) {
      throw new Error("Lead ID is required");
    }

    console.log(`Processing pre-qualification email for lead: ${leadId}`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Error fetching lead:", leadError);
      throw new Error("Lead not found");
    }

    if (!lead.email) {
      throw new Error("Lead does not have an email address");
    }

    // Generate unique token for the questionnaire
    const token = generateToken();
    
    // Update lead with token
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        questionnaire_token: token,
        questionnaire_sent_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      console.error("Error updating lead with token:", updateError);
      throw new Error("Failed to update lead with questionnaire token");
    }

    // Build the questionnaire URL
    const appUrl = Deno.env.get("APP_URL") || "https://trusted-deal-navigator.lovable.app";
    const questionnaireUrl = `${appUrl}/questionnaire/${token}`;

    console.log(`Sending email to ${lead.email} with questionnaire URL: ${questionnaireUrl}`);

    // Get Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Send branded email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trusted Deal Navigator <ilan@maverich.ai>",
        to: [lead.email],
        subject: "Next Steps: Complete Your Pre-Qualification",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); padding: 40px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Trusted Deal Navigator
              </h1>
              <p style="margin: 8px 0 0 0; color: #c9a227; font-size: 14px; font-weight: 500;">
                Your Partner in Business Financing
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1e3a5f; font-size: 24px; font-weight: 600;">
                Hello ${lead.name}! 👋
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Thank you for your interest in working with us! We're excited to move forward with your pre-qualification process.
              </p>
              
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                To help us understand your needs better and match you with the right financing options, please take a moment to answer a few quick questions. It should only take about <strong>2 minutes</strong>.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0 32px 0;">
                    <a href="${questionnaireUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a227 0%, #d4af37 100%); color: #1e3a5f; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(201, 162, 39, 0.4);">
                      Complete Your Pre-Qualification →
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #f7fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #1e3a5f; font-size: 16px; font-weight: 600;">
                  What We'll Ask You About:
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                  <li>Your business type and industry</li>
                  <li>Funding amount you're seeking</li>
                  <li>Timeline for when you need the funds</li>
                  <li>Your approximate annual revenue</li>
                  <li>How you plan to use the funding</li>
                </ul>
              </div>
              
              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
                If you have any questions, simply reply to this email and we'll be happy to help.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1e3a5f; padding: 32px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 14px; font-weight: 500;">
                Trusted Deal Navigator
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                Helping businesses secure the funding they need
              </p>
            </td>
          </tr>
        </table>
        
        <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
          This email was sent to ${lead.email}. If you believe you received this in error, please disregard.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Error sending email:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-prequalification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
