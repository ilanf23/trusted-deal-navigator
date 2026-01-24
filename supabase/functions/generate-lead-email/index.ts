import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, emailType, leadContext: providedContext, currentStage } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let lead: any = null;
    let questionnaire: any = null;
    let rateWatch: any = null;

    // If leadContext is provided directly (from move_forward), use it
    if (providedContext) {
      lead = {
        name: providedContext.name,
        email: providedContext.email,
        phone: providedContext.phone,
        company_name: providedContext.company,
        notes: providedContext.notes,
      };
      questionnaire = {
        loan_amount: providedContext.loanAmount,
        loan_type: providedContext.loanType,
        funding_purpose: providedContext.fundingPurpose,
        funding_timeline: providedContext.fundingTimeline,
      };
    } else if (leadId) {
      // Fetch lead data from database
      const { data: fetchedLead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (leadError || !fetchedLead) {
        console.error("Lead fetch error:", leadError);
        return new Response(JSON.stringify({ error: "Lead not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      lead = fetchedLead;

      // Fetch questionnaire responses
      const { data: responses } = await supabase
        .from("lead_responses")
        .select("*")
        .eq("lead_id", leadId)
        .order("submitted_at", { ascending: false })
        .limit(1);

      questionnaire = responses?.[0] || null;

      // Fetch rate watch data
      const { data: rateWatchData } = await supabase
        .from("rate_watch")
        .select("*")
        .eq("lead_id", leadId)
        .eq("is_active", true)
        .single();
      
      rateWatch = rateWatchData;
    } else {
      return new Response(JSON.stringify({ error: "Lead ID or context is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Build context for AI
    let leadContext = `
Lead Information:
- Name: ${lead.name}
- Email: ${lead.email || "Not provided"}
- Phone: ${lead.phone || "Not provided"}
- Company: ${lead.company_name || "Not provided"}
- Status: ${lead.status}
- Source: ${lead.source || "Unknown"}
`;

    if (rateWatch) {
      leadContext += `
Rate Watch Information:
- Current Rate: ${rateWatch.current_rate}%
- Target Rate: ${rateWatch.target_rate}%
- Rate Status: ${rateWatch.current_rate <= rateWatch.target_rate ? "Target Met!" : `${(rateWatch.current_rate - rateWatch.target_rate).toFixed(3)}% above target`}
- Loan Type: ${rateWatch.loan_type || "Not specified"}
- Loan Amount: ${rateWatch.loan_amount ? `$${rateWatch.loan_amount.toLocaleString()}` : "Not specified"}
- Enrolled: ${new Date(rateWatch.enrolled_at).toLocaleDateString()}
- Last Contacted: ${rateWatch.last_contacted_at ? new Date(rateWatch.last_contacted_at).toLocaleDateString() : "Never"}
- Notes: ${rateWatch.notes || "None"}
`;
    }

    if (questionnaire) {
      leadContext += `
Questionnaire Responses:
- Loan Type: ${questionnaire.loan_type || "Not specified"}
- Loan Amount: ${questionnaire.loan_amount ? `$${questionnaire.loan_amount.toLocaleString()}` : "Not specified"}
- Purpose: ${questionnaire.purpose_of_loan || questionnaire.funding_purpose || "Not specified"}
- Business Type: ${questionnaire.business_type || "Not specified"}
- Business Description: ${questionnaire.business_description || "Not specified"}
- Annual Revenue: ${questionnaire.annual_revenue || "Not specified"}
- Year Founded: ${questionnaire.year_business_founded || "Not specified"}
- Credit Score: ${questionnaire.borrower_credit_score || "Not specified"}
- Property Value: ${questionnaire.current_estimated_value ? `$${questionnaire.current_estimated_value.toLocaleString()}` : "Not specified"}
- Current Loan Balance: ${questionnaire.current_loan_balance ? `$${questionnaire.current_loan_balance.toLocaleString()}` : "Not specified"}
- Current Rate: ${questionnaire.current_loan_rate || "Not specified"}
- Desired Rate: ${questionnaire.desired_interest_rate || "Not specified"}
- Desired Term: ${questionnaire.desired_term || "Not specified"}
- Funding Timeline: ${questionnaire.funding_timeline || "Not specified"}
- Location: ${[questionnaire.city, questionnaire.state].filter(Boolean).join(", ") || "Not specified"}
`;
    }

    // Determine email type and prompt
    let systemPrompt = `You are a professional commercial lending consultant at Commercial Lending X. Write compelling, personalized emails that build relationships and drive action. Be warm but professional. Keep emails concise (under 200 words). Always include a clear call-to-action. Start with "Subject: " followed by the subject line, then a blank line, then the email body.`;

    let userPrompt = "";

    if (emailType === "move_forward") {
      const stageNextSteps: Record<string, string> = {
        "Discovery": "schedule a discovery call to understand their needs better",
        "Pre-Qualification": "request initial documents needed for pre-qualification (tax returns, financial statements)",
        "Doc Collection": "follow up on outstanding documents and keep the process moving",
        "Underwriting": "provide an update on underwriting status and ask if they have any questions",
        "Approval": "congratulate them on approval and outline next steps for closing",
        "Funded": "thank them for their business and ask for referrals",
      };
      
      const nextStep = stageNextSteps[currentStage || "Discovery"] || "move the deal forward to the next phase";
      
      userPrompt = `Write a professional email to move this deal forward. The lead is currently in the "${currentStage || 'Discovery'}" stage. The goal is to ${nextStep}.

Reference their last email context: "${providedContext?.lastEmailSubject}" - "${providedContext?.lastEmailSnippet}"

${leadContext}`;
    } else if (emailType === "rate_alert" && rateWatch) {
      if (rateWatch.current_rate <= rateWatch.target_rate) {
        userPrompt = `Write an exciting email to inform this lead that interest rates have dropped to their target level. Emphasize the refinancing opportunity and potential savings. Suggest scheduling a call to discuss next steps.

${leadContext}`;
      } else {
        userPrompt = `Write a check-in email for this rate watch subscriber. Let them know you're monitoring rates for them and provide an update on current market conditions. Maintain the relationship without being pushy.

${leadContext}`;
      }
    } else if (emailType === "follow_up") {
      userPrompt = `Write a professional follow-up email to re-engage this lead. Reference their specific loan needs and offer assistance in moving forward with their financing goals.

${leadContext}`;
    } else if (emailType === "introduction") {
      userPrompt = `Write a warm introduction email for this new lead. Thank them for their interest, briefly explain how Commercial Lending X can help with their specific needs, and invite them to schedule a consultation.

${leadContext}`;
    } else {
      userPrompt = `Write a professional email appropriate for this lead's current situation. Consider their loan needs, status, and any rate watch or questionnaire data available.

${leadContext}`;
    }

    console.log("Generating email for lead:", lead?.name || leadId, "type:", emailType);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "OpenAI rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402 || response.status === 401) {
        return new Response(JSON.stringify({ error: "OpenAI API key issue. Please check your API key and billing." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error("OpenAI API error");
    }

    const aiData = await response.json();
    const generatedContent = aiData.choices?.[0]?.message?.content || "";

    // Parse subject and body from generated content
    let subject = "";
    let body = generatedContent;

    // Try to extract subject line if AI included it
    const subjectMatch = generatedContent.match(/^Subject:\s*(.+?)(?:\n|$)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = generatedContent.replace(subjectMatch[0], "").trim();
    } else {
      // Generate a subject based on email type
      if (emailType === "rate_alert" && rateWatch?.current_rate <= rateWatch?.target_rate) {
        subject = `Great News: Your Target Rate Has Been Reached!`;
      } else if (emailType === "rate_alert") {
        subject = `Rate Watch Update: ${lead.name}`;
      } else if (emailType === "follow_up") {
        subject = `Following Up on Your ${questionnaire?.loan_type || "Loan"} Inquiry`;
      } else if (emailType === "introduction") {
        subject = `Welcome to Commercial Lending X, ${lead.name.split(" ")[0]}!`;
      } else {
        subject = `Commercial Lending X - ${lead.name}`;
      }
    }

    console.log("Email generated successfully for lead:", leadId);

    return new Response(
      JSON.stringify({
        subject,
        body,
        to: lead.email || "",
        leadName: lead.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
