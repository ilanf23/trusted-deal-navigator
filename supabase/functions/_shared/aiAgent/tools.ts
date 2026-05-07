// supabase/functions/_shared/aiAgent/tools.ts
// OpenAI function-calling tool definitions for AI agent mode.
// Shared by ai-assistant-agent edge function.

export const agentTools = [
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
