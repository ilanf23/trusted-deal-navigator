import { createClient } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { getProviderKey } from "../_shared/userIntegrations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, "lender-program-assistant", 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let teamMemberId: string | null = null;
    try {
      const auth = await getUserFromRequest(req, supabaseAdmin);
      teamMemberId = auth.teamMember?.id ?? null;
    } catch {
      teamMemberId = null;
    }

    const OPENAI_API_KEY = await getProviderKey(
      supabaseAdmin,
      teamMemberId,
      "openai",
      "OPENAI_API_KEY",
    );
    if (!OPENAI_API_KEY) {
      throw new Error("No OpenAI API key available (user integration or OPENAI_API_KEY)");
    }

    const { message, leadContext } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: programs, error: programsError } = await supabaseAdmin
      .from("lender_programs")
      .select("*")
      .order("lender_name");

    if (programsError) {
      throw programsError;
    }

    const programsContext = programs.map((p) =>
      `- ${p.lender_name} | ${p.program_name} (${p.program_type}): ${p.description || 'No description'}. ` +
      `Loan range: $${p.min_loan?.toLocaleString() || 'N/A'} - $${p.max_loan?.toLocaleString() || 'N/A'}. ` +
      `Interest: ${p.interest_range || 'N/A'}. Term: ${p.term || 'N/A'}.`
    ).join("\n");

    let leadInfo = "";
    if (leadContext) {
      leadInfo = `\n\nCurrent Lead/Caller Context:\n` +
        `- Name: ${leadContext.name || 'Unknown'}\n` +
        `- Company: ${leadContext.company || 'N/A'}\n` +
        `- Loan Type Requested: ${leadContext.loanType || 'N/A'}\n` +
        `- Loan Amount: ${leadContext.loanAmount ? `$${leadContext.loanAmount.toLocaleString()}` : 'N/A'}\n` +
        `- Purpose: ${leadContext.purpose || 'N/A'}\n` +
        `- Annual Revenue: ${leadContext.annualRevenue || 'N/A'}\n` +
        `- Business Type: ${leadContext.businessType || 'N/A'}`;
    }

    const systemPrompt = `You are a commercial lending advisor assistant. You help loan officers find the best lender programs for their clients.

Available Lender Programs:
${programsContext}
${leadInfo}

Instructions:
- When asked about programs, provide specific recommendations based on the criteria
- Always mention the lender name and program name
- Include relevant details like loan ranges, interest rates, and terms
- If asked for the best match, analyze the lead context (if provided) and suggest the top 2-3 programs that fit
- Be concise but informative
- If you don't have enough information to make a recommendation, ask clarifying questions about loan amount, purpose, or business type`;

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
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Lender program assistant error:", error instanceof Error ? error.message : "unknown");
    const message = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
