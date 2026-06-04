// supabase/functions/_shared/aiAgent/tools.ts
// Vercel AI SDK write-tool definitions for AI agent mode (Zod inputSchema).
// Shared by the ai-assistant-agent edge function.
//
// These tools have NO standalone `execute` — the agent runs every action through
// `executeAction()` so it can map args, emit SSE progress, and log changes to
// `ai_events` for undo/redo. `buildAgentSdkTools(run)` wires each tool's execute
// to a single runner the agent provides (see ai-assistant-agent/index.ts).

import { tool } from "npm:ai@6";
import { z } from "npm:zod";

/** The agent supplies this; it maps args, executes, emits SSE, and logs audit. */
export type AgentToolRunner = (name: string, args: Record<string, any>) => Promise<unknown>;

export function buildAgentSdkTools(run: AgentToolRunner) {
  const w = (name: string) => (args: Record<string, any>) => run(name, args ?? {});

  return {
    update_lead: tool({
      description: "Update a field on a lead record",
      inputSchema: z.object({
        lead_id: z.string().describe("UUID of the lead"),
        field: z.string().describe("Field name to update (status, notes, next_action, waiting_on, tags, etc.)"),
        new_value: z.string().describe("New value for the field"),
      }),
      execute: w("update_lead"),
    }),
    create_task: tool({
      description: "Create a new task",
      inputSchema: z.object({
        title: z.string(),
        lead_id: z.string().optional().describe("Optional lead UUID to link the task"),
        priority: z.enum(["low", "medium", "high"]).optional(),
        due_date: z.string().optional().describe("ISO date string (YYYY-MM-DD)"),
        description: z.string().optional(),
      }),
      execute: w("create_task"),
    }),
    complete_task: tool({
      description: "Mark a task as completed",
      inputSchema: z.object({
        task_id: z.string().describe("UUID of the task"),
      }),
      execute: w("complete_task"),
    }),
    log_activity: tool({
      description: "Log an activity (call, email, meeting, note) on a lead",
      inputSchema: z.object({
        lead_id: z.string(),
        activity_type: z.enum(["call", "email", "meeting", "note"]),
        content: z.string(),
      }),
      execute: w("log_activity"),
    }),
    bulk_update_leads: tool({
      description: "Update a field on multiple leads at once",
      inputSchema: z.object({
        lead_ids: z.array(z.string()).describe("Array of lead UUIDs"),
        field: z.string(),
        new_value: z.string(),
      }),
      execute: w("bulk_update_leads"),
    }),
  };
}
