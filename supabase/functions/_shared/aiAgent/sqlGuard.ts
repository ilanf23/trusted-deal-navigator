// supabase/functions/_shared/aiAgent/sqlGuard.ts
// Pure, defense-in-depth validator for the owner-only run_read_sql fallback.
// The authoritative security boundary is the clx_ai_readonly role's table
// grants (see migration 20260604121000_ai_read_sql.sql). This just gives
// clean, early rejections for obviously-unsafe input.

export interface SqlGuardResult {
  ok: boolean;
  reason?: string;
}

// Keywords that must never appear as statements in a read-only query.
const FORBIDDEN = [
  "insert", "update", "delete", "drop", "alter", "grant", "revoke",
  "truncate", "copy", "create", "comment", "vacuum", "analyze",
  "merge", "call", "do", "set", "reset", "begin", "commit", "rollback",
];

export function validateReadOnlySql(raw: string): SqlGuardResult {
  if (!raw || !raw.trim()) return { ok: false, reason: "empty query" };

  // Strip line and block comments so they can't hide keywords.
  const noComments = raw
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");

  const trimmed = noComments.trim();

  // Allow at most one trailing semicolon; reject any internal one (chaining).
  const withoutTrailing = trimmed.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return { ok: false, reason: "multiple statements are not allowed" };
  }

  const lower = withoutTrailing.toLowerCase();

  // Must start with SELECT or WITH (read CTE).
  if (!/^(select|with)\b/.test(lower)) {
    return { ok: false, reason: "only SELECT/WITH queries are allowed" };
  }

  // Reject forbidden keywords appearing as whole words anywhere.
  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`).test(lower)) {
      return { ok: false, reason: `forbidden keyword: ${kw}` };
    }
  }

  return { ok: true };
}
