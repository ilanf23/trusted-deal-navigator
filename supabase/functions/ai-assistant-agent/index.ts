import { getRequestClients } from '../_shared/userClient.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { getProviderKey } from '../_shared/userIntegrations.ts';
import { LLM_CHAT_ENDPOINT, LLM_MODEL, LLM_PROVIDER, LLM_API_KEY_ENV, llmHeaders } from '../_shared/llmConfig.ts';
import { executeAction } from '../_shared/aiAgent/executor.ts';
import { agentTools } from '../_shared/aiAgent/tools.ts';
import { logAiAudit } from '../_shared/aiAgent/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-agent', 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { userClient, serviceClient } = getRequestClients(req);
    const { authUserId, teamMember, isOwner } = await getUserFromRequest(req, userClient);

    const body = await req.json();
    const { prompt, conversationId, teamMemberId: tmId } = body;
    const LLM_API_KEY = await getProviderKey(
      serviceClient,
      teamMember?.id ?? null,
      LLM_PROVIDER,
      LLM_API_KEY_ENV,
    );
    if (!LLM_API_KEY) {
      throw new Error(`No LLM API key available (user integration or ${LLM_API_KEY_ENV})`);
    }

    // Fetch context data (deals, tasks). Owners can target other team members
    // via the `teamMemberId` body param; non-owners are scoped to themselves
    // regardless of the client-supplied id.
    const memberId = isOwner ? (tmId || teamMember?.id) : teamMember?.id;
    let dealsQuery = userClient
      .from('deals_v')
      .select('id, pipeline, name, company_name, status, assigned_to, updated_at, deal_value, potential_revenue, fee_percent')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (!isOwner && memberId) {
      dealsQuery = dealsQuery.eq('assigned_to', memberId);
    }

    const { data: deals } = await dealsQuery;
    const { data: tasks } = await userClient
      .from("tasks")
      .select("id, title, status, priority, due_date, is_completed, lead_id")
      .eq("is_completed", false)
      .limit(30);

    const contextStr = `
Available deals: ${JSON.stringify(deals?.map(d => ({ id: d.id, name: d.name, company: d.company_name, status: d.status, pipeline: d.pipeline, last_update: d.updated_at })) || [])}

Available tasks: ${JSON.stringify(tasks?.map(t => ({ id: t.id, title: t.title, priority: t.priority, due: t.due_date, lead_id: t.lead_id })) || [])}

Today: ${new Date().toISOString().split("T")[0]}`;

    // Create batch (gracefully handle if table doesn't exist yet)
    let batchId: string | null = null;
    try {
      const { data: batch } = await serviceClient
        .from("ai_agent_batches")
        .insert({
          conversation_id: conversationId,
          user_id: authUserId,
          mode: "agent",
          prompt_summary: prompt.substring(0, 200),
          total_changes: 0,
        })
        .select("id")
        .single();
      batchId = batch?.id || null;
    } catch (e) {
      console.warn("Could not create batch (table may not exist):", e);
    }

    // Stream SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, any>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send({ type: "text", content: "Processing your request..." });

          // Call OpenAI with tools
          const openaiMessages = [
            {
              role: "system",
              content: `You are an AI agent for CommercialLendingX, a commercial loan brokerage CRM. You can make changes to the CRM by calling the provided functions.

## Instructions
- Use the context below to identify the correct records (deals, tasks) by their IDs
- When the user asks to update, create, or modify CRM data, use the appropriate tool functions
- If the user asks something you cannot do with the available tools (like changing UI/icons, code changes, etc.), respond with a helpful text message explaining what you can and cannot do
- Be concise in your responses
- Always use real record IDs from the context data — never fabricate UUIDs
- If no matching records are found, tell the user

## Available Actions
- update_lead: Update any field on a lead (status, notes, next_action, waiting_on, etc.)
- create_task: Create a new task with title, priority, due date
- complete_task: Mark a task as done
- log_activity: Log a call, email, meeting, or note activity on a lead
- bulk_update_leads: Update the same field on multiple leads at once

${contextStr}`,
            },
            { role: "user", content: prompt },
          ];

          let totalChanges = 0;
          let iterations = 0;
          const maxIterations = 5;

          while (iterations < maxIterations) {
            iterations++;

            const response = await fetch(LLM_CHAT_ENDPOINT, {
              method: "POST",
              headers: llmHeaders(LLM_API_KEY),
              body: JSON.stringify({
                model: LLM_MODEL,
                messages: openaiMessages,
                tools: agentTools,
                tool_choice: "auto",
              }),
            });

            if (!response.ok) {
              const errText = await response.text();
              send({ type: "error", content: `OpenAI error: ${errText}` });
              await logAiAudit({
                serviceClient,
                userId: authUserId,
                conversationId,
                functionName: 'ai-assistant-agent',
                tool: 'openai_call',
                mode: 'agent',
                success: false,
                errorMessage: `OpenAI error: ${errText}`,
              });
              break;
            }

            const data = await response.json();
            const choice = data.choices[0];
            const message = choice.message;

            openaiMessages.push(message);

            // If the model wants to call tools
            if (message.tool_calls && message.tool_calls.length > 0) {
              for (const toolCall of message.tool_calls) {
                const fnName = toolCall.function.name;
                const fnArgs = JSON.parse(toolCall.function.arguments);

                // Map OpenAI function args to our action params
                let actionParams: Record<string, string> = {};
                if (fnName === "update_lead") {
                  actionParams = { dealId: fnArgs.deal_id ?? fnArgs.lead_id, pipeline: fnArgs.pipeline ?? '', field: fnArgs.field, newValue: fnArgs.new_value };
                } else if (fnName === "create_task") {
                  actionParams = { title: fnArgs.title, leadId: fnArgs.lead_id || "", priority: fnArgs.priority || "medium", dueDate: fnArgs.due_date || "", description: fnArgs.description || "" };
                } else if (fnName === "complete_task") {
                  actionParams = { taskId: fnArgs.task_id };
                } else if (fnName === "log_activity") {
                  actionParams = { leadId: fnArgs.lead_id, activityType: fnArgs.activity_type, content: fnArgs.content };
                } else if (fnName === "bulk_update_leads") {
                  actionParams = { lead_ids: JSON.stringify(fnArgs.lead_ids), field: fnArgs.field, newValue: fnArgs.new_value };
                }

                send({ type: "tool_start", tool: fnName, description: `Executing ${fnName}...` });

                const result = await executeAction(
                  serviceClient, fnName, actionParams,
                  authUserId, memberId || null, conversationId,
                  "agent", batchId, totalChanges, isOwner,
                );

                totalChanges += result.success ? 1 : 0;

                await logAiAudit({
                  serviceClient,
                  userId: authUserId,
                  conversationId,
                  functionName: 'ai-assistant-agent',
                  tool: fnName,
                  scope: { actionParams },
                  recordIds: result.changeId ? [result.changeId] : [],
                  mode: 'agent',
                  success: result.success,
                  errorMessage: result.success ? undefined : result.description,
                });

                send({
                  type: "tool_result",
                  success: result.success,
                  description: result.description,
                  changeId: result.changeId,
                });

                // Feed result back to OpenAI
                openaiMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result),
                } as any);
              }
            } else {
              // Model is done — send final text
              if (message.content) {
                send({ type: "text", content: message.content });
              }
              break;
            }

            if (choice.finish_reason === "stop") break;
          }

          // Update batch total (gracefully)
          if (batchId) {
            try {
              await serviceClient
                .from("ai_agent_batches")
                .update({ total_changes: totalChanges })
                .eq("id", batchId);
            } catch (e) {
              console.warn("Could not update batch total:", e);
            }
          }

          send({ type: "batch_complete", batchId, totalChanges });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err: any) {
          send({ type: "error", content: err.message });
          try {
            await logAiAudit({
              serviceClient,
              userId: authUserId,
              conversationId,
              functionName: 'ai-assistant-agent',
              tool: 'agent_stream',
              mode: 'agent',
              success: false,
              errorMessage: err?.message ?? String(err),
            });
          } catch { /* audit must not break the stream close */ }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    console.error('ai-assistant-agent error:', error);
    try {
      const { serviceClient } = getRequestClients(req);
      await logAiAudit({
        serviceClient,
        // Sentinel UUID: this path may run before the JWT is resolved.
        // Safe because logAiAudit uses serviceClient (RLS bypassed).
        userId: '00000000-0000-0000-0000-000000000000',
        functionName: 'ai-assistant-agent',
        tool: 'agent_run',
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
