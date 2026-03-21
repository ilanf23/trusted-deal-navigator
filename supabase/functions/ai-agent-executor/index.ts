import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Get user info from JWT
async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("No authorization header");

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid token");

  // Get team member
  const { data: teamMember } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  // Check if owner
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isOwner = roles?.some(r => r.role === "admin") || false;

  return { user, teamMember, isOwner };
}

// Execute a single action and log the change
async function executeAction(
  supabase: ReturnType<typeof createClient>,
  actionType: string,
  params: Record<string, string>,
  userId: string,
  teamMemberId: string | null,
  conversationId: string | null,
  mode: "assist" | "agent",
  batchId: string | null,
  batchOrder: number,
  isOwner: boolean,
): Promise<{ success: boolean; description: string; changeId?: string }> {
  try {
    switch (actionType) {
      case "update_lead": {
        const { leadId, field, newValue, oldValue } = params;
        if (!leadId || !field || !newValue) {
          return { success: false, description: "Missing required params: leadId, field, newValue" };
        }

        // Fetch current state
        const { data: current, error: fetchErr } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .single();

        if (fetchErr || !current) {
          return { success: false, description: `Lead ${leadId} not found` };
        }

        // Scope check for non-owners
        if (!isOwner && teamMemberId && current.assigned_to !== teamMemberId) {
          return { success: false, description: "Access denied: lead not assigned to you" };
        }

        const oldValues = { [field]: current[field] };
        const newValues = { [field]: newValue };

        // Perform update
        const { error: updateErr } = await supabase
          .from("leads")
          .update({ [field]: newValue, updated_at: new Date().toISOString() })
          .eq("id", leadId);

        if (updateErr) {
          return { success: false, description: `Update failed: ${updateErr.message}` };
        }

        // Log change
        const { data: changeRow } = await supabase
          .from("ai_agent_changes")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            team_member_id: teamMemberId,
            mode,
            target_table: "leads",
            target_id: leadId,
            operation: "update",
            old_values: oldValues,
            new_values: newValues,
            description: `Updated ${field} from "${oldValues[field] || 'null'}" to "${newValue}" on lead ${current.name || leadId}`,
            batch_id: batchId,
            batch_order: batchOrder,
          })
          .select("id")
          .single();

        return {
          success: true,
          description: `Updated ${current.name || 'lead'}: ${field} → ${newValue}`,
          changeId: changeRow?.id,
        };
      }

      case "create_task": {
        const { title, leadId, priority = "medium", dueDate, description: desc } = params;
        if (!title) {
          return { success: false, description: "Missing required param: title" };
        }

        const taskData: Record<string, any> = {
          title,
          priority,
          is_completed: false,
          status: "pending",
        };
        if (leadId) taskData.lead_id = leadId;
        if (dueDate) taskData.due_date = dueDate;
        if (desc) taskData.description = desc;
        if (teamMemberId) taskData.assignee_id = teamMemberId;

        const { data: task, error: taskErr } = await supabase
          .from("tasks")
          .insert(taskData)
          .select("id")
          .single();

        if (taskErr) {
          return { success: false, description: `Task creation failed: ${taskErr.message}` };
        }

        await supabase.from("ai_agent_changes").insert({
          conversation_id: conversationId,
          user_id: userId,
          team_member_id: teamMemberId,
          mode,
          target_table: "tasks",
          target_id: task.id,
          operation: "insert",
          old_values: null,
          new_values: taskData,
          description: `Created task: "${title}"${dueDate ? ` (due ${dueDate})` : ""}`,
          batch_id: batchId,
          batch_order: batchOrder,
        });

        return { success: true, description: `Created task: "${title}"`, changeId: task.id };
      }

      case "complete_task": {
        const { taskId } = params;
        if (!taskId) return { success: false, description: "Missing taskId" };

        const { data: current } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", taskId)
          .single();

        if (!current) return { success: false, description: "Task not found" };

        const { error } = await supabase
          .from("tasks")
          .update({ is_completed: true, status: "completed" })
          .eq("id", taskId);

        if (error) return { success: false, description: `Failed: ${error.message}` };

        await supabase.from("ai_agent_changes").insert({
          conversation_id: conversationId,
          user_id: userId,
          team_member_id: teamMemberId,
          mode,
          target_table: "tasks",
          target_id: taskId,
          operation: "update",
          old_values: { is_completed: false, status: current.status },
          new_values: { is_completed: true, status: "completed" },
          description: `Completed task: "${current.title}"`,
          batch_id: batchId,
          batch_order: batchOrder,
        });

        return { success: true, description: `Completed task: "${current.title}"` };
      }

      case "create_note": {
        const { content, leadId } = params;
        if (!content) return { success: false, description: "Missing content" };

        const noteData: Record<string, any> = { content, is_pinned: false };
        if (leadId) noteData.lead_id = leadId;

        const { data: note, error } = await supabase
          .from("notes")
          .insert(noteData)
          .select("id")
          .single();

        if (error) return { success: false, description: `Note creation failed: ${error.message}` };

        await supabase.from("ai_agent_changes").insert({
          conversation_id: conversationId,
          user_id: userId,
          team_member_id: teamMemberId,
          mode,
          target_table: "notes",
          target_id: note.id,
          operation: "insert",
          old_values: null,
          new_values: noteData,
          description: `Created note: "${content.substring(0, 50)}..."`,
          batch_id: batchId,
          batch_order: batchOrder,
        });

        return { success: true, description: `Created note` };
      }

      case "log_activity": {
        const { leadId, activityType = "note", content } = params;
        if (!leadId || !content) return { success: false, description: "Missing leadId or content" };

        const commData = {
          lead_id: leadId,
          communication_type: activityType,
          direction: "outbound" as const,
          content,
          status: "completed",
        };

        const { data: comm, error } = await supabase
          .from("communications")
          .insert(commData)
          .select("id")
          .single();

        if (error) return { success: false, description: `Activity log failed: ${error.message}` };

        await supabase.from("ai_agent_changes").insert({
          conversation_id: conversationId,
          user_id: userId,
          team_member_id: teamMemberId,
          mode,
          target_table: "communications",
          target_id: comm.id,
          operation: "insert",
          old_values: null,
          new_values: commData,
          description: `Logged ${activityType} activity on lead`,
          batch_id: batchId,
          batch_order: batchOrder,
        });

        return { success: true, description: `Logged ${activityType} activity` };
      }

      case "bulk_update_leads": {
        const { lead_ids: leadIdsStr, field, newValue } = params;
        if (!leadIdsStr || !field || !newValue) {
          return { success: false, description: "Missing params for bulk update" };
        }

        let leadIds: string[];
        try {
          leadIds = JSON.parse(leadIdsStr);
        } catch {
          return { success: false, description: "Invalid lead_ids format" };
        }

        let updated = 0;
        for (const leadId of leadIds) {
          const result = await executeAction(
            supabase, "update_lead",
            { leadId, field, newValue, oldValue: "" },
            userId, teamMemberId, conversationId, mode, batchId, batchOrder + updated, isOwner,
          );
          if (result.success) updated++;
        }

        return { success: true, description: `Bulk updated ${updated}/${leadIds.length} leads` };
      }

      default:
        return { success: false, description: `Unknown action type: ${actionType}` };
    }
  } catch (err: any) {
    return { success: false, description: `Error: ${err.message}` };
  }
}

// Undo a single change
async function undoChange(supabase: ReturnType<typeof createClient>, changeId: string, userId: string) {
  const { data: change, error } = await supabase
    .from("ai_agent_changes")
    .select("*")
    .eq("id", changeId)
    .single();

  if (error || !change) throw new Error("Change not found");
  if (change.status !== "applied" && change.status !== "redone") {
    throw new Error(`Cannot undo change with status: ${change.status}`);
  }

  const { target_table, target_id, operation, old_values, new_values } = change;

  if (operation === "update" && old_values) {
    const { error: updateErr } = await supabase
      .from(target_table)
      .update(old_values)
      .eq("id", target_id);
    if (updateErr) throw new Error(`Undo failed: ${updateErr.message}`);
  } else if (operation === "insert") {
    const { error: deleteErr } = await supabase
      .from(target_table)
      .delete()
      .eq("id", target_id);
    if (deleteErr) throw new Error(`Undo failed: ${deleteErr.message}`);
  } else if (operation === "delete" && old_values) {
    const { error: insertErr } = await supabase
      .from(target_table)
      .insert({ id: target_id, ...old_values });
    if (insertErr) throw new Error(`Undo failed: ${insertErr.message}`);
  }

  await supabase
    .from("ai_agent_changes")
    .update({ status: "undone", undone_at: new Date().toISOString(), undone_by: userId })
    .eq("id", changeId);

  return { success: true };
}

// Redo a single change
async function redoChange(supabase: ReturnType<typeof createClient>, changeId: string) {
  const { data: change, error } = await supabase
    .from("ai_agent_changes")
    .select("*")
    .eq("id", changeId)
    .single();

  if (error || !change) throw new Error("Change not found");
  if (change.status !== "undone") {
    throw new Error(`Cannot redo change with status: ${change.status}`);
  }

  const { target_table, target_id, operation, new_values } = change;

  if (operation === "update") {
    const { error: updateErr } = await supabase
      .from(target_table)
      .update(new_values)
      .eq("id", target_id);
    if (updateErr) throw new Error(`Redo failed: ${updateErr.message}`);
  } else if (operation === "insert") {
    const { error: insertErr } = await supabase
      .from(target_table)
      .insert({ id: target_id, ...new_values });
    if (insertErr) throw new Error(`Redo failed: ${insertErr.message}`);
  } else if (operation === "delete") {
    const { error: deleteErr } = await supabase
      .from(target_table)
      .delete()
      .eq("id", target_id);
    if (deleteErr) throw new Error(`Redo failed: ${deleteErr.message}`);
  }

  await supabase
    .from("ai_agent_changes")
    .update({ status: "redone", undone_at: null, undone_by: null })
    .eq("id", changeId);

  return { success: true };
}

// OpenAI tool definitions for Agent mode
const agentTools = [
  {
    type: "function" as const,
    function: {
      name: "update_lead",
      description: "Update a field on a lead record",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID of the lead" },
          field: { type: "string", description: "Field name to update (status, notes, next_action, waiting_on, tags, etc.)" },
          new_value: { type: "string", description: "New value for the field" },
        },
        required: ["lead_id", "field", "new_value"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Create a new task",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          lead_id: { type: "string", description: "Optional lead UUID to link the task" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string", description: "ISO date string (YYYY-MM-DD)" },
          description: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description: "Mark a task as completed",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID of the task" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_note",
      description: "Create a note, optionally linked to a lead",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          lead_id: { type: "string", description: "Optional lead UUID" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_activity",
      description: "Log an activity (call, email, meeting, note) on a lead",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string" },
          activity_type: { type: "string", enum: ["call", "email", "meeting", "note"] },
          content: { type: "string" },
        },
        required: ["lead_id", "activity_type", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bulk_update_leads",
      description: "Update a field on multiple leads at once",
      parameters: {
        type: "object",
        properties: {
          lead_ids: { type: "array", items: { type: "string" }, description: "Array of lead UUIDs" },
          field: { type: "string" },
          new_value: { type: "string" },
        },
        required: ["lead_ids", "field", "new_value"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, "ai-agent-executor", 20, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { user, teamMember, isOwner } = await getUserFromRequest(req);

    // === Single action execution (Assist mode confirms) ===
    if (action === "execute") {
      const { actionType, params, conversationId, mode = "assist" } = body;

      // Create a batch for single actions too (gracefully handle missing table)
      let batch: { id: string } | null = null;
      try {
        const { data } = await supabase
          .from("ai_agent_batches")
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            mode,
            prompt_summary: `${actionType}: ${params?.label || ""}`,
            total_changes: 1,
          })
          .select("id")
          .single();
        batch = data;
      } catch (e) {
        console.warn("Could not create batch:", e);
      }

      const result = await executeAction(
        supabase,
        actionType,
        params,
        user.id,
        teamMember?.id || null,
        conversationId,
        mode,
        batch?.id || null,
        0,
        isOwner,
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Undo single change ===
    if (action === "undo") {
      const result = await undoChange(supabase, body.changeId, user.id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Redo single change ===
    if (action === "redo") {
      const result = await redoChange(supabase, body.changeId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Undo entire batch ===
    if (action === "undo_batch") {
      const { batchId } = body;
      const { data: changes } = await supabase
        .from("ai_agent_changes")
        .select("id")
        .eq("batch_id", batchId)
        .in("status", ["applied", "redone"])
        .order("batch_order", { ascending: false });

      let undone = 0;
      for (const change of (changes || [])) {
        try {
          await undoChange(supabase, change.id, user.id);
          undone++;
        } catch (e) {
          console.error(`Failed to undo change ${change.id}:`, e);
        }
      }

      // Update batch status
      await supabase
        .from("ai_agent_batches")
        .update({
          status: undone === (changes?.length || 0) ? "fully_undone" : "partially_undone",
        })
        .eq("id", batchId);

      return new Response(
        JSON.stringify({ success: true, undone, total: changes?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === Agent mode: autonomous tool calling ===
    if (action === "agent") {
      const { prompt, conversationId, teamMemberId: tmId } = body;
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

      // Fetch context data (leads, tasks)
      const memberId = tmId || teamMember?.id;
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
            user_id: user.id,
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
                  tool_choice: iterations === 1 ? "auto" : "auto",
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
                    user.id, memberId || null, conversationId,
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
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("ai-agent-executor error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
