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
          .update({ is_completed: true, status: "done", completed_at: new Date().toISOString() })
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
          new_values: { is_completed: true, status: "done" },
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

export async function undoChange(supabase: ReturnType<typeof createClient>, changeId: string, userId: string) {
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
export async function redoChange(supabase: ReturnType<typeof createClient>, changeId: string) {
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
