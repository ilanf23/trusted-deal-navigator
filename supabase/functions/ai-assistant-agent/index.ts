import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { executeAction } from '../_shared/aiAgent/executor.ts';
import { agentTools } from '../_shared/aiAgent/tools.ts';

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

  const rateLimitResponse = await enforceRateLimit(req, 'ai-assistant-agent', 10, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { authUserId, teamMember, isOwner } = await getUserFromRequest(req, supabase);

    const { prompt, conversationId, teamMemberId: tmId } = body;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Fetch context data (leads, tasks). Owners can target other team members
    // via the `teamMemberId` body param; non-owners are scoped to themselves
    // regardless of the client-supplied id.
    const memberId = isOwner ? (tmId || teamMember?.id) : teamMember?.id;
    let leadsQuery = supabase
      .from("leads")
      .select("id, name, company_name, status, email, phone, updated_at, notes, next_action, waiting_on")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (!isOwner && memberId) {
      leadsQuery = leadsQuery.eq("assigned_to", memberId);
    }

    const { data: leads } = await leadsQuery;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, is_completed, lead_id")
      .eq("is_completed", false)
      .limit(30);

    const contextStr = `
Available leads: ${JSON.stringify(leads?.map(l => ({ id: l.id, name: l.name, company: l.company_name, status: l.status, last_update: l.updated_at })) || [])}

Available tasks: ${JSON.stringify(tasks?.map(t => ({ id: t.id, title: t.title, priority: t.priority, due: t.due_date, lead_id: t.lead_id })) || [])}

Today: ${new Date().toISOString().split("T")[0]}`;

    // Create batch (gracefully handle if table doesn't exist yet)
    let batchId: string | null = null;
    try {
      const { data: batch } = await supabase
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
- Use the context below to identify the correct records (leads, tasks) by their IDs
- When the user asks to update, create, or modify CRM data, use the appropriate tool functions
- If the user asks something you cannot do with the available tools (like changing UI/icons, code changes, etc.), respond with a helpful text message explaining what you can and cannot do
- Be concise in your responses
- Always use real record IDs from the context data — never fabricate UUIDs
- If no matching records are found, tell the user

## Available Actions
- update_lead: Update any field on a lead (status, notes, next_action, waiting_on, etc.)
- create_task: Create a new task with title, priority, due date
- complete_task: Mark a task as done
- create_note: Add a note, optionally linked to a lead
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

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: openaiMessages,
                tools: agentTools,
                tool_choice: "auto",
              }),
            });

            if (!response.ok) {
              const errText = await response.text();
              send({ type: "error", content: `OpenAI error: ${errText}` });
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
                  actionParams = { leadId: fnArgs.lead_id, field: fnArgs.field, newValue: fnArgs.new_value };
                } else if (fnName === "create_task") {
                  actionParams = { title: fnArgs.title, leadId: fnArgs.lead_id || "", priority: fnArgs.priority || "medium", dueDate: fnArgs.due_date || "", description: fnArgs.description || "" };
                } else if (fnName === "complete_task") {
                  actionParams = { taskId: fnArgs.task_id };
                } else if (fnName === "create_note") {
                  actionParams = { content: fnArgs.content, leadId: fnArgs.lead_id || "" };
                } else if (fnName === "log_activity") {
                  actionParams = { leadId: fnArgs.lead_id, activityType: fnArgs.activity_type, content: fnArgs.content };
                } else if (fnName === "bulk_update_leads") {
                  actionParams = { lead_ids: JSON.stringify(fnArgs.lead_ids), field: fnArgs.field, newValue: fnArgs.new_value };
                }

                send({ type: "tool_start", tool: fnName, description: `Executing ${fnName}...` });

                const result = await executeAction(
                  supabase, fnName, actionParams,
                  authUserId, memberId || null, conversationId,
                  "agent", batchId, totalChanges, isOwner,
                );

                totalChanges += result.success ? 1 : 0;

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
              await supabase
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
