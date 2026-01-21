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
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
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

    const systemPrompt = `You are Evan's AI sales assistant at CommercialLendingX, a commercial loan brokerage.

## Response Format Rules
- Keep responses SHORT and scannable (under 150 words unless asked for detail)
- Use clean formatting: headings, bullet points, numbered lists
- Lead with the answer, then supporting details
- Use bold for names, numbers, and key actions
- Avoid walls of text - break into digestible sections
- When listing items, max 5-7 per list unless specifically asked for more

## Your Capabilities
- Pipeline analysis and prioritization
- Lead insights and next-action recommendations
- Task management and scheduling suggestions
- Communication history lookups
- Draft follow-up messages and talking points

## Response Style Examples

Good: "**3 leads need follow-up today:**
1. **John Smith** (ABC Corp) - No contact in 8 days
2. **Jane Doe** - Awaiting documents
3. **Mike Wilson** - Ready for approval push"

Bad: "Based on my analysis of your pipeline, I can see that there are several leads that require attention. John Smith from ABC Corporation hasn't been contacted in approximately 8 days..."

${contextData}`;

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
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "OpenAI API error: " + errorText }), {
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
