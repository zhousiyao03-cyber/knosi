#!/usr/bin/env node
/**
 * Production Turso rollout — B1-5: four composite indexes.
 *
 * Adds composite "(user_id, sort_col)" style indexes so several hot
 * list queries drop their "USE TEMP B-TREE FOR ORDER BY" file-sort
 * step. Rationale is documented in docs/learn-backend/phase-b1.md
 * under B1-4 (audit) and B1-5 (apply).
 *
 * All four CREATE INDEX statements use IF NOT EXISTS so the script
 * is idempotent.
 *
 * Reads Turso credentials from .env.turso-prod.local at the repo root.
 *
 * Usage:
 *   node scripts/db/apply-2026-04-11-composite-indexes-rollout.mjs
 *
 * Exits 0 on success (including idempotent re-runs), 1 on failure.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..");

function loadEnv(path) {
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(join(repoRoot, ".env.turso-prod.local"));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const indexes = [
  {
    name: "notes_user_updated_idx",
    table: "notes",
    sql: "CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON notes (user_id, updated_at)",
    covers: "notes.list ORDER BY updated_at DESC",
  },
  {
    name: "bookmarks_user_created_idx",
    table: "bookmarks",
    sql: "CREATE INDEX IF NOT EXISTS bookmarks_user_created_idx ON bookmarks (user_id, created_at)",
    covers: "bookmarks.list ORDER BY created_at DESC",
  },
  {
    name: "todos_user_created_idx",
    table: "todos",
    sql: "CREATE INDEX IF NOT EXISTS todos_user_created_idx ON todos (user_id, created_at)",
    covers: "todos.list + dashboard.pendingTodos ORDER BY created_at DESC",
  },
  {
    name: "knowledge_index_jobs_status_queued_idx",
    table: "knowledge_index_jobs",
    sql: "CREATE INDEX IF NOT EXISTS knowledge_index_jobs_status_queued_idx ON knowledge_index_jobs (status, queued_at)",
    covers: "claimNextJob WHERE status='pending' AND queued_at <= ? ORDER BY queued_at",
  },
];

console.log("Production Turso rollout — B1-5: composite indexes");
console.log(`Target: ${url}`);
console.log("");

// ─────────────────────────────────────────────
// Step 1: dump the indexes that exist BEFORE
// ─────────────────────────────────────────────
console.log("Step 1: inspect existing indexes (before)");
for (const idx of indexes) {
  const res = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
    args: [idx.name],
  });
  const present = res.rows.length > 0;
  console.log(`  ${idx.name.padEnd(45)} ${present ? "present" : "missing"}`);
}
console.log("");

// ─────────────────────────────────────────────
// Step 2: apply
// ─────────────────────────────────────────────
console.log("Step 2: apply CREATE INDEX IF NOT EXISTS");
for (const idx of indexes) {
  try {
    await client.execute(idx.sql);
    console.log(`  OK — ${idx.name}`);
  } catch (err) {
    console.error(`  FAIL — ${idx.name}: ${err?.message ?? err}`);
    process.exit(1);
  }
}
console.log("");

// ─────────────────────────────────────────────
// Step 3: verify all four indexes now exist and are composite
// ─────────────────────────────────────────────
console.log("Step 3: verify (after)");
let ok = true;
for (const idx of indexes) {
  const res = await client.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type='index' AND name=?",
    args: [idx.name],
  });
  if (res.rows.length === 0) {
    console.error(`  FAIL — ${idx.name} not found after CREATE`);
    ok = false;
    continue;
  }
  const createSql = String(res.rows[0].sql ?? "");
  console.log(`  ${idx.name}`);
  console.log(`    covers: ${idx.covers}`);
  console.log(`    sql:    ${createSql}`);
}
console.log("");

// ─────────────────────────────────────────────
// Step 4: EXPLAIN QUERY PLAN the 4 target queries
// to prove the new indexes are actually picked
// ─────────────────────────────────────────────
console.log("Step 4: verify query plans use the new indexes");

const verifyQueries = [
  {
    label: "notes.list",
    sql: "EXPLAIN QUERY PLAN SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30",
    expectIndex: "notes_user_updated_idx",
  },
  {
    label: "bookmarks.list",
    sql: "EXPLAIN QUERY PLAN SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
    expectIndex: "bookmarks_user_created_idx",
  },
  {
    label: "todos.list",
    sql: "EXPLAIN QUERY PLAN SELECT * FROM todos WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 30",
    expectIndex: "todos_user_created_idx",
  },
  {
    label: "claimNextJob pending",
    sql: "EXPLAIN QUERY PLAN SELECT * FROM knowledge_index_jobs WHERE status = 'pending' AND queued_at <= ? ORDER BY queued_at ASC LIMIT 1",
    expectIndex: "knowledge_index_jobs_status_queued_idx",
  },
];

for (const vq of verifyQueries) {
  const args = vq.label === "todos.list" ? ["u", "todo"] : ["u"];
  // claimNextJob takes the integer directly
  const finalArgs =
    vq.label === "claimNextJob pending"
      ? [0]
      : vq.label === "todos.list"
        ? ["u", "todo"]
        : ["u"];
  try {
    const r = await client.execute({ sql: vq.sql, args: finalArgs });
    const plan = r.rows.map((row) => String(row.detail ?? "")).join(" | ");
    const usesIndex = plan.includes(vq.expectIndex);
    const noFileSort = !/TEMP B-TREE FOR ORDER BY/.test(plan);
    console.log(`  ${vq.label}:`);
    console.log(`    plan: ${plan}`);
    console.log(
      `    expected ${vq.expectIndex}? ${usesIndex ? "YES" : "NO"}`
    );
    console.log(`    no TEMP B-TREE? ${noFileSort ? "YES" : "NO"}`);
    if (!usesIndex || !noFileSort) {
      ok = false;
      console.error(`    FAIL — unexpected plan for ${vq.label}`);
    }
  } catch (err) {
    console.error(`    ERROR: ${err?.message ?? err}`);
    ok = false;
  }
}

console.log("");
if (!ok) {
  console.error("❌ Rollout verification failed");
  process.exit(1);
}
console.log("✅ Production rollout verified: 4 composite indexes present and used");
process.exit(0);
