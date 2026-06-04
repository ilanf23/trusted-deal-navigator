import { getRequestClients } from '../_shared/userClient.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { getProviderKey } from '../_shared/userIntegrations.ts';
import { LLM_CHAT_ENDPOINT, LLM_MODEL, LLM_PROVIDER, LLM_API_KEY_ENV, llmHeaders } from '../_shared/llmConfig.ts';
import { readToolSchemas, executeReadTool, type ReadToolContext } from '../_shared/aiAgent/readTools.ts';
import { logAiAudit } from '../_shared/aiAgent/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-chat', 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { userClient, serviceClient } = getRequestClients(req);
    const { teamMember, authUserId, isOwner, isFounder } = await getUserFromRequest(req, userClient);

    const LLM_API_KEY = await getProviderKey(
      serviceClient,
      teamMember?.id ?? null,
      LLM_PROVIDER,
      LLM_API_KEY_ENV,
    );
    if (!LLM_API_KEY) {
      throw new Error(`No LLM API key available (user integration or ${LLM_API_KEY_ENV})`);
    }

    const body = await req.json();
    const { messages, teamMemberId: requestedMemberId, mode = 'chat', currentPage = '' } = body;
    const scopedMemberId = isOwner ? (requestedMemberId || teamMember?.id) : teamMember?.id;
    const displayName = teamMember?.name?.trim() || 'there';

    await logAiAudit({
      serviceClient,
      userId: authUserId,
      functionName: 'ai-assistant-chat',
      tool: 'read_context',
      scope: { scopedMemberId, mode, currentPage },
      mode: mode as 'chat' | 'assist' | 'agent',
      success: true,
    });

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

### Rules
- Always explain what you're suggesting BEFORE the action tags
- Use real lead IDs and data from the CRM context below
- Multiple actions can be in one response
- Keep the label short and descriptive
- Include the leadId when the action relates to a specific lead`;

    const starterContext = `## How to answer
You do NOT have the data in front of you. To answer ANY question about deals,
tasks, communications, pipeline, revenue, or leads, you MUST call the provided
read tools to fetch live data first, then answer from the results. Never invent
numbers. ${isFounder
  ? 'You may use run_read_sql for arbitrary questions the other tools do not cover.'
  : 'You can only see this user\'s own assigned data.'}
Today: ${new Date().toISOString().split('T')[0]}`;

    let systemPrompt: string;
    if (mode === 'assist') {
      systemPrompt = `${basePrompt}${assistCapabilities}${pageContext}\n\n${starterContext}`;
    } else {
      systemPrompt = `${basePrompt}${chatCapabilities}${pageContext}\n\n${starterContext}`;
    }

    const toolCtx: ReadToolContext = {
      serviceClient,
      userClient,
      isFounder,
      memberId: scopedMemberId ?? null,
    };
    const tools = readToolSchemas(isFounder);

    const convo: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // --- Phase 1: resolve tool calls (non-streaming) ---
    const maxIterations = 5;
    for (let i = 0; i < maxIterations; i++) {
      const toolResp = await fetch(LLM_CHAT_ENDPOINT, {
        method: "POST",
        headers: llmHeaders(LLM_API_KEY),
        body: JSON.stringify({ model: LLM_MODEL, messages: convo, tools, tool_choice: "auto" }),
      });
      if (!toolResp.ok) {
        const errText = await toolResp.text();
        return new Response(JSON.stringify({ error: "LLM error: " + errText }), {
          status: toolResp.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const toolData = await toolResp.json();
      const msg = toolData.choices?.[0]?.message;
      convo.push(msg);
      if (!msg?.tool_calls?.length) break;

      for (const call of msg.tool_calls) {
        let result: unknown;
        try {
          result = await executeReadTool(toolCtx, call.function.name, JSON.parse(call.function.arguments || "{}"));
        } catch (e) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }
        await logAiAudit({
          serviceClient,
          userId: authUserId,
          functionName: 'ai-assistant-chat',
          tool: call.function.name,
          scope: { args: call.function.arguments, isFounder },
          mode: 'chat',
          success: !(result as any)?.error,
          errorMessage: (result as any)?.error,
        });
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    // --- Phase 2: stream the final answer (tools disabled) ---
    const response = await fetch(LLM_CHAT_ENDPOINT, {
      method: "POST",
      headers: llmHeaders(LLM_API_KEY),
      body: JSON.stringify({ model: LLM_MODEL, messages: convo, tool_choice: "none", stream: true }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("LLM API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "LLM API error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error('ai-assistant-chat error:', error);
    try {
      const { serviceClient } = getRequestClients(req);
      await logAiAudit({
        serviceClient,
        // Sentinel UUID: the failure path may run before the JWT has been
        // resolved, so we don't always have a real auth.uid(). This insert
        // is OK because logAiAudit uses serviceClient (RLS bypassed); if the
        // path ever switches to userClient, the WITH CHECK auth.uid() = user_id
        // policy on ai_audit_log would reject this sentinel.
        userId: '00000000-0000-0000-0000-000000000000',
        functionName: 'ai-assistant-chat',
        tool: 'read_context',
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch { /* never fail the response on audit error */ }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
