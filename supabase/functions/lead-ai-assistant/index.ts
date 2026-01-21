import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadContext {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  activities: Array<{ type: string; content: string; date: string }>;
  communications: Array<{ type: string; direction: string; duration: number | null; transcript: string | null; date: string }>;
  tasks: Array<{ title: string; status: string; due_date: string | null; priority: string }>;
  customFields: {
    address: string;
    loanType: string;
    loanAmount: string;
    businessType: string;
    propertyType: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, leadContext, question } = await req.json() as {
      action: 'summarize' | 'ask' | 'autofill';
      leadContext: LeadContext;
      question?: string;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    // Build context string
    const contextStr = `
Lead Information:
- Name: ${leadContext.name}
- Company: ${leadContext.company || 'Not specified'}
- Email: ${leadContext.email || 'Not specified'}
- Phone: ${leadContext.phone || 'Not specified'}
- Current Stage: ${leadContext.status}
- Lead Source: ${leadContext.source || 'Not specified'}
- Notes: ${leadContext.notes || 'None'}

Custom Fields:
- Address: ${leadContext.customFields.address || 'Not specified'}
- Loan Type: ${leadContext.customFields.loanType || 'Not specified'}
- Loan Amount: ${leadContext.customFields.loanAmount || 'Not specified'}
- Business Type: ${leadContext.customFields.businessType || 'Not specified'}
- Property Type: ${leadContext.customFields.propertyType || 'Not specified'}

Recent Activities (${leadContext.activities.length}):
${leadContext.activities.slice(0, 5).map(a => `- [${a.date}] ${a.type}: ${a.content}`).join('\n') || 'No activities'}

Communications (${leadContext.communications.length}):
${leadContext.communications.slice(0, 5).map(c => 
  `- [${c.date}] ${c.direction} ${c.type}${c.duration ? ` (${Math.floor(c.duration / 60)}min)` : ''}${c.transcript ? `\n  Transcript excerpt: "${c.transcript.slice(0, 200)}..."` : ''}`
).join('\n') || 'No communications'}

Tasks (${leadContext.tasks.length}):
${leadContext.tasks.slice(0, 5).map(t => `- [${t.status}] ${t.title} (${t.priority} priority)${t.due_date ? ` - Due: ${t.due_date}` : ''}`).join('\n') || 'No tasks'}
`;

    switch (action) {
      case 'summarize':
        systemPrompt = `You are a helpful CRM assistant for a commercial lending company. Provide concise, actionable summaries of lead information. Focus on deal potential, next steps, and key insights.`;
        userPrompt = `Please provide a brief summary of this lead, including:
1. Deal Overview (2-3 sentences)
2. Current Status & Next Steps
3. Key Insights or Concerns
4. Recommended Actions

${contextStr}`;
        break;

      case 'ask':
        systemPrompt = `You are a helpful CRM assistant for a commercial lending company. Answer questions about leads based on the provided context. Be specific and reference the data when possible.`;
        userPrompt = `Based on this lead's information, please answer the following question:

Question: ${question}

${contextStr}`;
        break;

      case 'autofill':
        systemPrompt = `You are a CRM data assistant. Based on the lead's communications, notes, and activities, suggest values for custom fields. Return ONLY a valid JSON object with suggested field values.`;
        userPrompt = `Analyze this lead's data and suggest appropriate values for the custom fields. Based on the communications, notes, and context, infer:
- address (property or business address if mentioned)
- loanType (SBA 7(a), SBA 504, Bridge Loan, Commercial Real Estate, Medical Practice, etc.)
- loanAmount (dollar amount if mentioned)
- businessType (industry/business category)
- propertyType (Office, Retail, Multi-Family, Industrial, Medical, etc.)

Return ONLY a JSON object like: {"address": "...", "loanType": "...", "loanAmount": "...", "businessType": "...", "propertyType": "..."}
Leave empty string for fields you cannot determine.

${contextStr}`;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // For autofill, parse the JSON response
    if (action === 'autofill') {
      try {
        // Extract JSON from response (it might be wrapped in markdown code blocks)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify({ success: true, result: parsed, action }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Failed to parse autofill JSON:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, result: content, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Lead AI assistant error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
