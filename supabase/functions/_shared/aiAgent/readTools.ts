// supabase/functions/_shared/aiAgent/readTools.ts
// Read-tool definitions + executors for the CLX Assistant chat loop.
// Curated tools run via the service-role client with scope enforced in code:
// founders are unscoped (company-wide); everyone else is forced to their own
// assigned_to. run_read_sql is founder-only and runs via the USER client so
// the RPC can resolve auth.uid().

import type { SupabaseClient } from "../supabase.ts";
import { validateReadOnlySql } from "./sqlGuard.ts";

export interface ReadToolContext {
  serviceClient: SupabaseClient; // RLS-bypassing; scope enforced in code below
  userClient: SupabaseClient;    // carries caller JWT; used only for run_read_sql
  isFounder: boolean;
  memberId: string | null;       // the caller's users.id (for rep scoping)
}

// OpenAI/OpenRouter function-calling schemas exposed to the model.
export function readToolSchemas(isFounder: boolean) {
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "query_deals",
        description: "List deals filtered by pipeline, status, outcome, value range, or update date. Returns deal rows.",
        parameters: {
          type: "object",
          properties: {
            pipeline: { type: "string", enum: ["potential", "underwriting", "lender_management"] },
            status: { type: "string", description: "Exact status value to match" },
            outcome: { type: "string", enum: ["open", "won", "lost", "abandoned"] },
            min_value: { type: "number", description: "Minimum deal_value" },
            updated_within_days: { type: "number", description: "Only deals updated within the last N days" },
            limit: { type: "number", description: "Max rows (default 50, max 200)" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_metrics",
        description: "Aggregate pipeline metrics: open counts, total value, and expected revenue, grouped by pipeline. Optionally narrow to one pipeline.",
        parameters: {
          type: "object",
          properties: {
            pipeline: { type: "string", enum: ["potential", "underwriting", "lender_management"], description: "Optional pipeline filter" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "search_communications",
        description: "Find recent communications (calls/emails/notes) optionally filtered by deal/lead id, type, or a keyword in the content/transcript.",
        parameters: {
          type: "object",
          properties: {
            lead_id: { type: "string", description: "Optional deal/lead UUID" },
            communication_type: { type: "string", description: "e.g. call, email, sms, note" },
            keyword: { type: "string", description: "Case-insensitive substring to match in content/transcript" },
            limit: { type: "number", description: "Max rows (default 30, max 100)" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "lookup_lead",
        description: "Get a 360 view of one deal/lead: the deal row, its open tasks, recent communications, and questionnaire responses.",
        parameters: {
          type: "object",
          properties: {
            lead_id: { type: "string", description: "The deal/lead UUID" },
          },
          required: ["lead_id"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "query_tasks",
        description: "List tasks filtered by completion, priority, or due-date window.",
        parameters: {
          type: "object",
          properties: {
            is_completed: { type: "boolean", description: "Default false (pending tasks)" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            overdue_only: { type: "boolean", description: "Only tasks past their due_date" },
            limit: { type: "number", description: "Max rows (default 50, max 200)" },
          },
        },
      },
    },
  ];

  if (isFounder) {
    tools.push({
      type: "function" as const,
      function: {
        name: "run_read_sql",
        description: "Founder-only. Run an arbitrary READ-ONLY SQL SELECT against the business database when no other tool fits. Use standard Postgres. Allowlisted tables: deals_v, potential, underwriting, lender_management, tasks, communications, appointments, email_threads, deal_responses, dropbox_files, invoices, partner_referrals, lender_programs, deal_lender_programs, revenue_targets, rate_watch, people, company_people, users. Results are capped at 500 rows.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "A single read-only SELECT or WITH query." },
          },
          required: ["query"],
        },
      },
    } as any);
  }

  return tools;
}

// Clamp helper for caller-supplied limits.
function clampLimit(n: unknown, def: number, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : def;
  return Math.max(1, Math.min(max, v));
}

// Apply rep scoping: founders unscoped, everyone else forced to own assigned_to.
function scopeDeals(query: any, ctx: ReadToolContext) {
  return ctx.isFounder || !ctx.memberId ? query : query.eq("assigned_to", ctx.memberId);
}

export async function executeReadTool(
  ctx: ReadToolContext,
  name: string,
  args: Record<string, any>,
): Promise<unknown> {
  const svc = ctx.serviceClient;

  switch (name) {
    case "query_deals": {
      let q = svc.from("deals_v").select(
        "id, pipeline, name, company_name, status, deal_outcome, priority, deal_value, potential_revenue, assigned_to, updated_at",
      );
      q = scopeDeals(q, ctx);
      if (args.pipeline) q = q.eq("pipeline", args.pipeline);
      if (args.status) q = q.eq("status", args.status);
      if (args.outcome) q = q.eq("deal_outcome", args.outcome);
      if (typeof args.min_value === "number") q = q.gte("deal_value", args.min_value);
      if (typeof args.updated_within_days === "number") {
        const since = new Date(Date.now() - args.updated_within_days * 86400000).toISOString();
        q = q.gte("updated_at", since);
      }
      q = q.order("updated_at", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { rows: data, count: data?.length ?? 0 };
    }

    case "get_metrics": {
      // Reuse the existing SECURITY INVOKER RPC via the service client. Pass
      // p_assigned_to to scope reps; null for founders (company-wide).
      const { data, error } = await svc.rpc("get_pipeline_value", {
        p_pipeline: args.pipeline ?? null,
        p_assigned_to: ctx.isFounder ? null : ctx.memberId,
      });
      if (error) return { error: error.message };
      return { metrics: data };
    }

    case "search_communications": {
      let q = svc.from("communications").select(
        "id, lead_id, communication_type, direction, created_at, content, transcript, duration_seconds, phone_number",
      );
      if (args.lead_id) q = q.eq("lead_id", args.lead_id);
      if (args.communication_type) q = q.eq("communication_type", args.communication_type);
      if (args.keyword) q = q.or(`content.ilike.%${args.keyword}%,transcript.ilike.%${args.keyword}%`);
      q = q.order("created_at", { ascending: false }).limit(clampLimit(args.limit, 30, 100));
      const { data, error } = await q;
      if (error) return { error: error.message };
      // Reps can only see comms tied to their own deals. Resolve allowed deal ids.
      if (!ctx.isFounder && ctx.memberId) {
        const { data: mine } = await svc.from("deals_v").select("id").eq("assigned_to", ctx.memberId);
        const allowed = new Set((mine ?? []).map((d: any) => d.id));
        return { rows: (data ?? []).filter((c: any) => !c.lead_id || allowed.has(c.lead_id)) };
      }
      return { rows: data };
    }

    case "lookup_lead": {
      if (!args.lead_id) return { error: "lead_id is required" };
      let dealQ = svc.from("deals_v").select("*").eq("id", args.lead_id);
      dealQ = scopeDeals(dealQ, ctx);
      const { data: deal } = await dealQ.maybeSingle();
      if (!deal) return { error: "Deal not found or not visible to you" };
      const [{ data: tasks }, { data: comms }, { data: responses }] = await Promise.all([
        svc.from("tasks").select("id, title, status, priority, due_date").eq("lead_id", args.lead_id).eq("is_completed", false),
        svc.from("communications").select("communication_type, direction, created_at, content, transcript").eq("lead_id", args.lead_id).order("created_at", { ascending: false }).limit(20),
        svc.from("deal_responses").select("*").eq("lead_id", args.lead_id).limit(5),
      ]);
      return { deal, tasks, communications: comms, responses };
    }

    case "query_tasks": {
      let q = svc.from("tasks").select("id, title, status, priority, due_date, is_completed, lead_id, user_id");
      if (!ctx.isFounder && ctx.memberId) q = q.eq("user_id", ctx.memberId);
      q = q.eq("is_completed", args.is_completed === true ? true : false);
      if (args.priority) q = q.eq("priority", args.priority);
      if (args.overdue_only) q = q.lt("due_date", new Date().toISOString());
      q = q.order("due_date", { ascending: true }).limit(clampLimit(args.limit, 50, 200));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { rows: data };
    }

    case "run_read_sql": {
      if (!ctx.isFounder) return { error: "run_read_sql is restricted to founders" };
      const guard = validateReadOnlySql(String(args.query ?? ""));
      if (!guard.ok) return { error: `Rejected: ${guard.reason}` };
      // Must use the USER client so the RPC's auth.uid() resolves to the caller.
      const { data, error } = await ctx.userClient.rpc("run_read_sql", { p_query: args.query });
      if (error) return { error: error.message };
      return { rows: data };
    }

    default:
      return { error: `Unknown read tool: ${name}` };
  }
}
