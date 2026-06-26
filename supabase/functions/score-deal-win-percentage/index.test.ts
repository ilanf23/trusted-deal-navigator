import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  handleScoreDealWinPercentageRequest,
  resolveScoringCaller,
} from "./index.ts";

type TeamMember = {
  id: string;
  app_role: string;
  is_owner: boolean;
  is_active: boolean;
} | null;

function makeQueryBuilder(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    error: null,
    count: null,
    select() {
      return this;
    },
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    update() {
      return {
        eq: async () => ({ error: null }),
      };
    },
    insert: async () => ({ error: null }),
    ...overrides,
  };
}

function makeAuthSupabase(options: {
  authUserId?: string | null;
  authError?: Error | null;
  teamMember?: TeamMember;
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: options.authUserId ? { id: options.authUserId } : null },
        error: options.authError ?? null,
      }),
    },
    from(table: string) {
      if (table !== "users") throw new Error(`Unexpected table ${table}`);
      return makeQueryBuilder({
        maybeSingle: async () => ({
          data: options.teamMember ?? null,
          error: null,
        }),
      });
    },
  };
}

async function assertCallerRejected(
  name: string,
  options: Parameters<typeof makeAuthSupabase>[0],
  authHeader: string | null,
  status: number,
) {
  await assertRejects(
    () => resolveScoringCaller(makeAuthSupabase(options), authHeader),
    Error,
    undefined,
    name,
  ).then((error) => {
    assertEquals((error as Error & { status?: number }).status, status);
  });
}

Deno.test("resolveScoringCaller rejects missing bearer token", async () => {
  await assertCallerRejected(
    "missing bearer",
    { authUserId: "auth-1", teamMember: null },
    null,
    401,
  );
});

Deno.test("resolveScoringCaller rejects invalid JWT", async () => {
  await assertCallerRejected(
    "invalid JWT",
    { authUserId: null, authError: new Error("invalid jwt"), teamMember: null },
    "Bearer bad-token",
    401,
  );
});

Deno.test("resolveScoringCaller rejects valid JWT without users row", async () => {
  await assertCallerRejected(
    "no users row",
    { authUserId: "auth-1", teamMember: null },
    "Bearer valid-token",
    403,
  );
});

Deno.test("resolveScoringCaller rejects inactive users", async () => {
  await assertCallerRejected(
    "inactive user",
    {
      authUserId: "auth-1",
      teamMember: {
        id: "tm-1",
        app_role: "admin",
        is_owner: false,
        is_active: false,
      },
    },
    "Bearer valid-token",
    403,
  );
});

Deno.test("resolveScoringCaller rejects client role", async () => {
  await assertCallerRejected(
    "client role",
    {
      authUserId: "auth-1",
      teamMember: {
        id: "tm-1",
        app_role: "client",
        is_owner: false,
        is_active: true,
      },
    },
    "Bearer valid-token",
    403,
  );
});

for (const appRole of ["admin", "super_admin", "partner"]) {
  Deno.test(`resolveScoringCaller allows active ${appRole}`, async () => {
    const caller = await resolveScoringCaller(
      makeAuthSupabase({
        authUserId: "auth-1",
        teamMember: {
          id: "tm-1",
          app_role: appRole,
          is_owner: false,
          is_active: true,
        },
      }),
      "Bearer valid-token",
    );

    assertEquals(caller, {
      authUserId: "auth-1",
      teamMemberId: "tm-1",
      appRole,
      isFounder: appRole === "super_admin",
    });
  });
}

function makeRequest(authHeader = "Bearer valid-token") {
  return new Request("http://localhost/score-deal-win-percentage", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ leadId: "deal-1" }),
  });
}

function makeHandlerSupabase(options: {
  teamMember?: TeamMember;
  deal?: {
    id: string;
    assigned_to: string | null;
    win_percentage: number | null;
  } | null;
  calls: {
    updates: unknown[];
    audits: unknown[];
  };
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "auth-1" } },
        error: null,
      }),
    },
    from(table: string) {
      if (table === "users") {
        return makeQueryBuilder({
          maybeSingle: async () => ({
            data: options.teamMember ?? null,
            error: null,
          }),
        });
      }

      if (table === "deals") {
        return makeQueryBuilder({
          maybeSingle: async () => ({
            data: options.deal ?? null,
            error: null,
          }),
          update(values: unknown) {
            options.calls.updates.push(values);
            return {
              eq: async () => ({ error: null }),
            };
          },
        });
      }

      if (table === "ai_events") {
        return makeQueryBuilder({
          insert: async (payload: unknown) => {
            options.calls.audits.push(payload);
            return { error: null };
          },
        });
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function featureResult() {
  return {
    features: {
      deal_value: 100000,
      priority: "high",
      stage_name: "Underwriting",
      stage_position: 2,
      total_pipeline_stages: 5,
      source: "referral",
      flagged_for_weekly: false,
      close_date: null,
      previous_win_percentage: 41,
      days_since_created: 10,
      days_since_last_activity: 1,
      days_since_last_contact: 2,
      communications_count: 3,
      call_count: 1,
      total_call_seconds: 600,
      transcripts_count: 1,
      emails_count: 2,
      activities_last_30d: 4,
      open_tasks: 1,
      overdue_tasks: 0,
      completed_tasks: 2,
      files_count: 1,
      file_extensions: ["pdf"],
      stale_deal: false,
      no_recent_call: false,
      has_documents: true,
      stage_progress_pct: 0.6,
      velocity_score: 0.06,
    },
    recentComms: [],
    recentEmails: [],
    recentNotes: [],
    potentialRow: {
      id: "deal-1",
      win_percentage: 41,
      updated_at: "2026-06-01T00:00:00.000Z",
    },
  };
}

Deno.test("handler rejects forbidden callers before building features", async () => {
  const calls = { updates: [], audits: [] };
  let buildFeaturesCalled = false;
  const response = await handleScoreDealWinPercentageRequest(makeRequest(), {
    createSupabaseClient: () =>
      makeHandlerSupabase({
        teamMember: {
          id: "tm-1",
          app_role: "client",
          is_owner: false,
          is_active: true,
        },
        deal: { id: "deal-1", assigned_to: "other-user", win_percentage: 41 },
        calls,
      }),
    buildFeatures: async () => {
      buildFeaturesCalled = true;
      return featureResult();
    },
    enforceRateLimit: async () => null,
  });

  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: "Forbidden" });
  assertEquals(buildFeaturesCalled, false);
});

Deno.test("handler returns 404 for missing deal after caller authorization", async () => {
  const calls = { updates: [], audits: [] };
  let buildFeaturesCalled = false;
  const response = await handleScoreDealWinPercentageRequest(makeRequest(), {
    createSupabaseClient: () =>
      makeHandlerSupabase({
        teamMember: {
          id: "tm-1",
          app_role: "admin",
          is_owner: false,
          is_active: true,
        },
        deal: null,
        calls,
      }),
    buildFeatures: async () => {
      buildFeaturesCalled = true;
      return featureResult();
    },
    enforceRateLimit: async () => null,
  });

  assertEquals(response.status, 404);
  assertEquals(await response.json(), { error: "Deal not found" });
  assertEquals(buildFeaturesCalled, false);
});

Deno.test("handler allows active internal user to score deal assigned to someone else", async () => {
  const calls = { updates: [], audits: [] };
  const response = await handleScoreDealWinPercentageRequest(makeRequest(), {
    createSupabaseClient: () =>
      makeHandlerSupabase({
        teamMember: {
          id: "tm-1",
          app_role: "partner",
          is_owner: false,
          is_active: true,
        },
        deal: { id: "deal-1", assigned_to: "other-user", win_percentage: 41 },
        calls,
      }),
    buildFeatures: async () => featureResult(),
    getProviderKey: async () => "test-key",
    fetch: async () =>
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                winPercentage: 78,
                confidence: "high",
                reasoning:
                  "Recent contact and documents support a strong score.",
              }),
            },
          }],
        }),
        { status: 200 },
      ),
    enforceRateLimit: async () => null,
  });

  assertEquals(response.status, 200);
  assertEquals(calls.updates.length, 1);
  assertEquals(calls.updates[0], {
    win_percentage: 78,
    updated_at: (calls.updates[0] as { updated_at: string }).updated_at,
  });
  assertEquals(calls.audits.length, 1);
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.winPercentage, 78);
  assertEquals(body.confidence, "high");
  assertEquals(
    body.reasoning,
    "Recent contact and documents support a strong score.",
  );
  assertEquals(body.signals.deal_value, 100000);
});
