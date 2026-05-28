import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { getProviderKey } from "../_shared/userIntegrations.ts";
import { LLM_CHAT_ENDPOINT, LLM_MODEL, LLM_PROVIDER, LLM_API_KEY_ENV, llmHeaders } from "../_shared/llmConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, "ai-email-chat", 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { leadId, messages } = await req.json();
    
    if (!leadId) {
      return new Response(JSON.stringify({ error: "Lead ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let teamMemberId: string | null = null;
    try {
      const auth = await getUserFromRequest(req, supabase);
      teamMemberId = auth.teamMember?.id ?? null;
    } catch {
      teamMemberId = null;
    }

    const LLM_API_KEY = await getProviderKey(
      supabase,
      teamMemberId,
      LLM_PROVIDER,
      LLM_API_KEY_ENV,
    );
    if (!LLM_API_KEY) {
      throw new Error(`No LLM API key available (user integration or ${LLM_API_KEY_ENV})`);
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Lead fetch error:", leadError);
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch rate watch data
    const { data: rateWatch } = await supabase
      .from("rate_watch")
      .select("*")
      .eq("lead_id", leadId)
      .eq("is_active", true)
      .single();

    // Build comprehensive lead context
    let leadContext = `
## Lead Information
- **Name**: ${lead.name}
- **Email**: ${lead.email || "Not provided"}
- **Phone**: ${lead.phone || "Not provided"}
- **Company**: ${lead.company_name || "Not provided"}
- **Status**: ${lead.status}
- **Source**: ${lead.source || "Unknown"}
- **Notes**: ${lead.notes || "None"}
`;

    if (rateWatch) {
      const rateStatus = rateWatch.current_rate <= rateWatch.target_rate ? "TARGET MET! Ready to refinance!" : `${(rateWatch.current_rate - rateWatch.target_rate).toFixed(3)}% above target`;
      leadContext += `
## Rate Watch Status
- **Current Rate**: ${rateWatch.current_rate}%
- **Target Rate**: ${rateWatch.target_rate}%
- **Status**: ${rateStatus}
- **Loan Type**: ${rateWatch.loan_type || "Not specified"}
- **Loan Amount**: ${rateWatch.loan_amount ? `$${rateWatch.loan_amount.toLocaleString()}` : "Not specified"}
- **Enrolled Since**: ${new Date(rateWatch.enrolled_at).toLocaleDateString()}
- **Last Contacted**: ${rateWatch.last_contacted_at ? new Date(rateWatch.last_contacted_at).toLocaleDateString() : "Never"}
- **Notes**: ${rateWatch.notes || "None"}
`;
    }

    // Fetch linked Dropbox files for additional context
    let dropboxContext = "";
    try {
      const { data: dropboxFiles } = await supabase
        .from("dropbox_files")
        .select("name, dropbox_path_display, extracted_text")
        .eq("lead_id", leadId)
        .eq("is_folder", false)
        .limit(5);

      if (dropboxFiles && dropboxFiles.length > 0) {
        dropboxContext = `\n## Linked Documents (from Dropbox)\n${dropboxFiles.map(f => {
          const preview = f.extracted_text ? f.extracted_text.substring(0, 500) + '...' : 'No text extracted';
          return `- **${f.name}**: ${preview}`;
        }).join('\n')}\n`;
      }
    } catch (err) {
      console.warn("Failed to fetch Dropbox files for email context:", err);
    }

    const systemPrompt = `You are an expert commercial lending consultant AI assistant at Commercial Lending X. Your job is to help write personalized, compelling emails for leads based on their specific situation.

## Your Context
You have access to complete lead data including their questionnaire responses, rate watch status, contact history, and linked documents. Use this information to write highly personalized emails.

## Lead Data
${leadContext}
${dropboxContext}

## Guidelines
1. **Be Personalized**: Reference specific details from the lead's data - their business type, loan amount, rates, etc.
2. **Be Professional**: Maintain a warm but professional tone appropriate for commercial lending.
3. **Be Concise**: Keep emails under 200 words unless asked for more detail.
4. **Include CTAs**: Always include a clear call-to-action (schedule a call, reply, etc.)
5. **Format Properly**: When writing emails, format them with a clear subject line and body.

## Email Format
When asked to write an email, format your response like this:
**Subject:** [Your subject line here]

**Body:**
[Email body here]

## Capabilities
- Write rate alert emails when target rates are met
- Write follow-up emails for leads who haven't responded
- Write introduction emails for new leads
- Customize tone, length, and style based on user requests
- Answer questions about the lead's data
- Help refine and improve drafts`;

    // Build messages array for OpenAI
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    ];

    console.log("AI chat for lead:", leadId, "messages:", messages.length);

    const response = await fetch(LLM_CHAT_ENDPOINT, {
      method: "POST",
      headers: llmHeaders(LLM_API_KEY),
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: chatMessages,
        max_tokens: 1500,
        temperature: 0.7,
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
    const responseContent = aiData.choices?.[0]?.message?.content || "";

    // Try to parse out subject and body if present
    let subject = "";
    let body = responseContent;

    const subjectMatch = responseContent.match(/\*\*Subject:\*\*\s*(.+?)(?:\n|$)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
    }

    const bodyMatch = responseContent.match(/\*\*Body:\*\*\s*([\s\S]*)/i);
    if (bodyMatch) {
      body = bodyMatch[1].trim();
    }

    console.log("AI chat response generated for lead:", leadId);

    return new Response(
      JSON.stringify({
        response: responseContent,
        subject: subject || null,
        body: body !== responseContent ? body : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in AI chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
