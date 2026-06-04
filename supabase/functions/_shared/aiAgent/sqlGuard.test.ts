// supabase/functions/_shared/aiAgent/sqlGuard.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateReadOnlySql } from "./sqlGuard.ts";

Deno.test("accepts a plain SELECT", () => {
  assertEquals(validateReadOnlySql("SELECT * FROM deals_v").ok, true);
});

Deno.test("accepts SELECT with leading whitespace/comments stripped", () => {
  assertEquals(validateReadOnlySql("  \n SELECT count(*) FROM tasks").ok, true);
});

Deno.test("accepts a WITH (CTE) read query", () => {
  assertEquals(validateReadOnlySql("WITH x AS (SELECT 1) SELECT * FROM x").ok, true);
});

Deno.test("rejects INSERT", () => {
  assertEquals(validateReadOnlySql("INSERT INTO tasks (title) VALUES ('x')").ok, false);
});

Deno.test("rejects UPDATE/DELETE/DROP/ALTER/GRANT/TRUNCATE/COPY", () => {
  for (const q of [
    "UPDATE tasks SET title='x'",
    "DELETE FROM tasks",
    "DROP TABLE tasks",
    "ALTER TABLE tasks ADD COLUMN y int",
    "GRANT ALL ON tasks TO public",
    "TRUNCATE tasks",
    "COPY tasks TO '/tmp/x'",
  ]) {
    assertEquals(validateReadOnlySql(q).ok, false, q);
  }
});

Deno.test("rejects statement chaining via semicolon", () => {
  assertEquals(validateReadOnlySql("SELECT 1; DROP TABLE tasks").ok, false);
});

Deno.test("allows a single trailing semicolon", () => {
  assertEquals(validateReadOnlySql("SELECT 1;").ok, true);
});

Deno.test("rejects a write keyword hidden after a CTE", () => {
  assertEquals(validateReadOnlySql("WITH x AS (SELECT 1) DELETE FROM tasks").ok, false);
});

Deno.test("rejects empty/blank input", () => {
  assertEquals(validateReadOnlySql("   ").ok, false);
});
