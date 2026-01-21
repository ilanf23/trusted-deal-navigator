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
    const { messages, evanId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Evan's data for context
    let contextData = "";

    if (evanId) {
      // Fetch leads assigned to Evan
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, company_name, status, email, phone, updated_at, notes")
        .eq("assigned_to", evanId)
        .order("updated_at", { ascending: false })
        .limit(50);

      // Fetch pending tasks
      const { data: tasks } = await supabase
        .from("evan_tasks")
        .select("id, title, description, status, priority, due_date, is_completed, lead_id")
        .eq("is_completed", false)
        .order("due_date", { ascending: true })
        .limit(30);

      // Fetch recent communications
      const { data: communications } = await supabase
        .from("evan_communications")
        .select("id, lead_id, communication_type, direction, created_at, content, duration_seconds")
        .order("created_at", { ascending: false })
        .limit(30);

      // Fetch notes
      const { data: notes } = await supabase
        .from("evan_notes")
        .select("id, content, is_pinned, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      // Build context string
      contextData = `
## Evan's CRM Data (Current as of ${new Date().toISOString()})

### Leads (${leads?.length || 0} total)
${leads?.map(l => `- ${l.name}${l.company_name ? ` (${l.company_name})` : ''}: Status: ${l.status}, Last updated: ${new Date(l.updated_at).toLocaleDateString()}${l.notes ? `, Notes: ${l.notes.substring(0, 100)}` : ''}`).join('\n') || 'No leads found'}

### Pipeline Summary
${(() => {
  const statusCounts: Record<string, number> = {};
  leads?.forEach(l => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });
  return Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count} leads`).join('\n') || 'No data';
})()}

### Pending Tasks (${tasks?.length || 0} total)
${tasks?.map(t => {
  const lead = leads?.find(l => l.id === t.lead_id);
  const dueStr = t.due_date ? `Due: ${new Date(t.due_date).toLocaleDateString()}` : 'No due date';
  return `- [${t.priority?.toUpperCase() || 'MEDIUM'}] ${t.title}${lead ? ` (${lead.name})` : ''} - ${dueStr}`;
}).join('\n') || 'No pending tasks'}

### Overdue Tasks
${tasks?.filter(t => t.due_date && new Date(t.due_date) < new Date()).map(t => {
  const lead = leads?.find(l => l.id === t.lead_id);
  return `- ${t.title}${lead ? ` (${lead.name})` : ''} - Was due: ${new Date(t.due_date!).toLocaleDateString()}`;
}).join('\n') || 'No overdue tasks'}

### Recent Communications (last 30)
${communications?.map(c => {
  const lead = leads?.find(l => l.id === c.lead_id);
  return `- ${new Date(c.created_at).toLocaleDateString()}: ${c.communication_type} (${c.direction}) ${lead ? `with ${lead.name}` : 'unknown contact'}${c.duration_seconds ? ` - ${Math.round(c.duration_seconds / 60)} min` : ''}`;
}).join('\n') || 'No recent communications'}

### Leads Needing Follow-up (no activity in 7+ days)
${(() => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const staleLeads = leads?.filter(l => new Date(l.updated_at) < sevenDaysAgo && l.status !== 'funded');
  return staleLeads?.map(l => `- ${l.name}${l.company_name ? ` (${l.company_name})` : ''}: Last activity ${Math.floor((Date.now() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24))} days ago`).join('\n') || 'All leads are up to date';
})()}

### Pinned Notes
${notes?.filter(n => n.is_pinned).map(n => `- ${n.content.substring(0, 200)}`).join('\n') || 'No pinned notes'}
`;
    }

    const systemPrompt = `You are Evan's AI sales assistant at CommercialLendingX, a commercial loan brokerage. You have access to Evan's CRM data including leads, tasks, communications, and notes.

Your role is to:
- Help Evan prioritize his work and manage his pipeline effectively
- Provide insights on leads and suggest next actions
- Answer questions about specific leads, tasks, or communications
- Help draft follow-up messages or talking points
- Identify opportunities and risks in the pipeline
- Summarize data when asked

Important guidelines:
- Be concise but thorough
- Use specific data from the context provided
- When suggesting actions, be specific about which leads or tasks
- If you don't have enough information, say so
- Format responses clearly with bullet points when listing items
- Always refer to leads by name when possible

${contextData}`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("evan-ai-assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
