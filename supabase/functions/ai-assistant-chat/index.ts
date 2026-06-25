import { getRequestClients } from '../_shared/userClient.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { streamText, stepCountIs } from 'npm:ai@6';
import { getProviderKey } from '../_shared/userIntegrations.ts';
import { LLM_PROVIDER, LLM_API_KEY_ENV } from '../_shared/llmConfig.ts';
import { buildReadSdkTools, type ReadToolContext } from '../_shared/aiAgent/readTools.ts';
import { resolveModel, DEFAULT_MODEL } from '../_shared/aiAgent/provider.ts';
import { logAiAudit } from '../_shared/aiAgent/audit.ts';
import { errorResponse } from '../_shared/responses.ts';

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
      // Rep scoping MUST pin to the caller's own id, never a client-supplied
      // value. scopedMemberId can be a request-controlled `requestedMemberId`
      // for loose `isOwner` employee-admins; using it here would let a
      // non-founder read another rep's data. Founders are unscoped, so
      // memberId only governs the non-founder path.
      memberId: teamMember?.id ?? null,
    };
    // Read tools as Vercel AI SDK tools. Each tool's `execute` runs the existing
    // `executeReadTool` (which keeps all rep-scoping/founder security) and the
    // audit hook logs every call, preserving the previous per-tool audit trail.
    const tools = buildReadSdkTools(toolCtx, isFounder, async (name, args, result) => {
      await logAiAudit({
        serviceClient,
        userId: authUserId,
        functionName: 'ai-assistant-chat',
        tool: name,
        scope: { args, isFounder },
        mode: 'chat',
        success: !(result as any)?.error,
        errorMessage: (result as any)?.error,
      });
    });

    // Resolve the provider/model (defaults to the OpenRouter model in llmConfig.ts).
    // A bad/unconfigured provider is a client error, surfaced before streaming.
    let model;
    try {
      model = await resolveModel(DEFAULT_MODEL, { openrouterKey: LLM_API_KEY });
    } catch (e) {
      return errorResponse('ai-assistant-chat', e, { corsHeaders, status: 400, clientMessage: 'AI provider configuration error' });
    }

    // streamText runs the read-tool loop server-side (up to 5 steps) and streams
    // the final answer as plain text. The frontend reads a plain text stream.
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      onError: ({ error }) => {
        console.error("ai-assistant-chat streamText error:", error);
      },
    });

    return result.toTextStreamResponse({ headers: corsHeaders });
  } catch (error) {
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
    return errorResponse('ai-assistant-chat', error, { corsHeaders });
  }
});
