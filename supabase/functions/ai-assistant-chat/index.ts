import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { buildChatContext } from '../_shared/aiAgent/context.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-chat', 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { teamMember, isOwner } = await getUserFromRequest(req, supabase);

    const body = await req.json();
    const { messages, teamMemberId: requestedMemberId, mode = 'chat', currentPage = '' } = body;
    const scopedMemberId = isOwner ? (requestedMemberId || teamMember?.id) : teamMember?.id;
    const displayName = teamMember?.name?.trim() || 'there';

    const contextData = await buildChatContext(supabase, scopedMemberId, displayName);

    const pageContext = currentPage ? `\n\n## Current Page\nThe user is currently viewing: ${currentPage}\nTailor your suggestions to be relevant to this page when possible.` : '';

    const basePrompt = `You are ${displayName}'s personal AI sales assistant at CommercialLendingX, a commercial loan brokerage.

## About ${displayName}
You are speaking directly with ${displayName}. Address them by name occasionally to keep the conversation personal and friendly. You are their dedicated assistant who knows their pipeline, tasks, and communication history.

## Response Format Rules
- Keep responses SHORT and scannable (under 150 words unless asked for detail)
- Use clean formatting: headings, bullet points, numbered lists
- Lead with the answer, then supporting details
- Use bold for names, numbers, and key actions
- Avoid walls of text - break into digestible sections
- When listing items, max 5-7 per list unless specifically asked for more
- Be warm and professional - you're a trusted colleague, not a robot`;

    const chatCapabilities = `
## Your Capabilities
- Pipeline analysis and prioritization
- Lead insights and next-action recommendations
- Task management and scheduling suggestions
- Communication history lookups
- Draft follow-up messages and talking points

## Response Style Examples

Good: "Hey ${displayName}! **3 leads need follow-up today:**
1. **John Smith** (ABC Corp) - No contact in 8 days
2. **Jane Doe** - Awaiting documents
3. **Mike Wilson** - Ready for approval push"

Bad: "Based on my analysis of your pipeline, I can see that there are several leads that require attention. John Smith from ABC Corporation hasn't been contacted in approximately 8 days..."`;

    const assistCapabilities = `
## Your Capabilities (Assist Mode)
You can suggest ACTIONS that the user can confirm before they execute. Include action tags inline in your response.

### Action Tag Format
Include these tags inline in your response text. Each action will be rendered as a confirmable card:

<action type="navigate" target="/admin/pipeline/lead/{leadId}" label="Go to {Lead Name}" />
<action type="draft_email" to="{email}" subject="{subject}" body="{body}" leadId="{leadId}" label="Draft follow-up email" />
<action type="update_lead" leadId="{leadId}" field="{field}" oldValue="{current}" newValue="{new}" label="Update {field} to {new}" />
<action type="create_task" title="{title}" dueDate="{YYYY-MM-DD}" priority="{high|medium|low}" leadId="{leadId}" label="Create task: {title}" />
<action type="complete_task" taskId="{taskId}" label="Complete task: {title}" />
<action type="log_activity" leadId="{leadId}" activityType="{call|email|meeting|note}" content="{description}" label="Log {type} activity" />
<action type="create_note" leadId="{leadId}" content="{note text}" label="Create note on {Lead Name}" />

### Rules
- Always explain what you're suggesting BEFORE the action tags
- Use real lead IDs and data from the CRM context below
- Multiple actions can be in one response
- Keep the label short and descriptive
- Include the leadId when the action relates to a specific lead`;

    let systemPrompt: string;
    if (mode === 'assist') {
      systemPrompt = `${basePrompt}${assistCapabilities}${pageContext}\n\n${contextData}`;
    } else {
      systemPrompt = `${basePrompt}${chatCapabilities}${pageContext}\n\n${contextData}`;
    }

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
    console.error('ai-assistant-chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
