// supabase/functions/_shared/aiAgent/executor.ts
// Single-action executor and undo/redo lifecycle for AI agent changes.
// Shared by ai-assistant-actions and ai-assistant-agent edge functions.

import { createClient } from "../supabase.ts";

// Execute a single action and log the change
export async function executeAction(
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
      case "update_lead":
      case "bulk_update_leads":
      case "log_activity": {
        return {
          success: false,
          description: `Action "${actionType}" must be rewritten against the deals_v model. Use a deal ID + pipeline (potential/underwriting/lender_management). Tracked in follow-on plan.`,
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
          status: "todo",
        };
        if (leadId) taskData.lead_id = leadId;
        if (dueDate) taskData.due_date = dueDate;
        if (desc) taskData.description = desc;
        if (teamMemberId) taskData.user_id = teamMemberId;

        const { data: task, error: taskErr } = await supabase
          .from("tasks")
          .insert(taskData)
          .select("id")
          .single();

        if (taskErr) {
          return { success: false, description: `Task creation failed: ${taskErr.message}` };
        }

        await supabase.from("ai_events").insert({
          event_type: "agent_change",
          user_id: userId,
          parent_id: batchId ?? conversationId,
          payload: {
            conversation_id: conversationId,
            team_member_id: teamMemberId,
            mode,
            target_table: "tasks",
            target_id: task.id,
            operation: "insert",
            old_values: null,
            new_values: taskData,
            description: `Created task: "${title}"${dueDate ? ` (due ${dueDate})` : ""}`,
            status: "applied",
            batch_order: batchOrder,
          },
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

        if (!isOwner && teamMemberId && current.user_id !== teamMemberId) {
          return { success: false, description: "Access denied: task not assigned to you" };
        }

        const { error } = await supabase
          .from("tasks")
          .update({ is_completed: true, status: "done", completed_at: new Date().toISOString() })
          .eq("id", taskId);

        if (error) return { success: false, description: `Failed: ${error.message}` };

        await supabase.from("ai_events").insert({
          event_type: "agent_change",
          user_id: userId,
          parent_id: batchId ?? conversationId,
          payload: {
            conversation_id: conversationId,
            team_member_id: teamMemberId,
            mode,
            target_table: "tasks",
            target_id: taskId,
            operation: "update",
            old_values: { is_completed: false, status: current.status },
            new_values: { is_completed: true, status: "done" },
            description: `Completed task: "${current.title}"`,
            status: "applied",
            batch_order: batchOrder,
          },
        });

        return { success: true, description: `Completed task: "${current.title}"` };
      }

      default:
        return { success: false, description: `Unknown action type: ${actionType}` };
    }
  } catch (err: any) {
    return { success: false, description: `Error: ${err.message}` };
  }
}

export async function undoChange(
  supabase: ReturnType<typeof createClient>,
  changeId: string,
  userId: string,
  isOwner: boolean,
) {
  const { data: event, error } = await supabase
    .from("ai_events")
    .select("*")
    .eq("id", changeId)
    .eq("event_type", "agent_change")
    .single();

  if (error || !event) throw new Error("Change not found");
  const change = event.payload as any;
  if (change.status !== "applied" && change.status !== "redone") {
    throw new Error(`Cannot undo change with status: ${change.status}`);
  }
  if (!isOwner && event.user_id !== userId) {
    throw new Error("Forbidden: cannot undo another user's change");
  }

  const { target_table, target_id, operation, old_values } = change;

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
    .from("ai_events")
    .update({
      payload: { ...change, status: "undone", undone_at: new Date().toISOString(), undone_by: userId },
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeId);

  return { success: true };
}

// Redo a single change
export async function redoChange(
  supabase: ReturnType<typeof createClient>,
  changeId: string,
  userId: string,
  isOwner: boolean,
) {
  const { data: event, error } = await supabase
    .from("ai_events")
    .select("*")
    .eq("id", changeId)
    .eq("event_type", "agent_change")
    .single();

  if (error || !event) throw new Error("Change not found");
  const change = event.payload as any;
  if (change.status !== "undone") {
    throw new Error(`Cannot redo change with status: ${change.status}`);
  }
  if (!isOwner && event.user_id !== userId) {
    throw new Error("Forbidden: cannot redo another user's change");
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
    .from("ai_events")
    .update({
      payload: { ...change, status: "redone", undone_at: null, undone_by: null },
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeId);

  return { success: true };
}
