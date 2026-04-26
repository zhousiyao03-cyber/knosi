#!/usr/bin/env node

/**
 * Production Turso rollout — daemon_conversations table.
 *
 * Source: drizzle/0038_jazzy_alice.sql (auto-generated from schema).
 * Spec:   docs/superpowers/specs/2026-04-25-daemon-persistent-worker-design.md
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT
 * EXISTS so re-running on an already-migrated DB is a no-op.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const statements = [
  `CREATE TABLE IF NOT EXISTS daemon_conversations (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    worker_key text NOT NULL,
    cli_session_id text,
    last_used_at integer NOT NULL,
    created_at integer NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS daemon_conversations_user_worker_idx
    ON daemon_conversations (user_id, worker_key)`,
];

console.log("Production Turso rollout — daemon_conversations");
console.log(`Target: ${url}`);
console.log("");

for (const [index, statement] of statements.entries()) {
  console.log(`Step ${index + 1}: apply statement`);
  await client.execute(statement);
}

console.log("");
console.log("Verification:");

const tableResult = await client.execute({
  sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  args: ["daemon_conversations"],
});
if (tableResult.rows.length === 0) {
  console.error("  FAIL — missing table daemon_conversations");
  process.exit(1);
}
console.log("  OK — table daemon_conversations exists");

const indexResult = await client.execute({
  sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
  args: ["daemon_conversations_user_worker_idx"],
});
if (indexResult.rows.length === 0) {
  console.error("  FAIL — missing index daemon_conversations_user_worker_idx");
  process.exit(1);
}
console.log("  OK — index daemon_conversations_user_worker_idx exists");

const columnResult = await client.execute({
  sql: "PRAGMA table_info('daemon_conversations')",
});
const expectedColumns = [
  "id",
  "user_id",
  "worker_key",
  "cli_session_id",
  "last_used_at",
  "created_at",
];
const actualColumns = columnResult.rows.map((r) => r.name);
for (const col of expectedColumns) {
  if (!actualColumns.includes(col)) {
    console.error(`  FAIL — missing column ${col}`);
    process.exit(1);
  }
  console.log(`  OK — column ${col} exists`);
}

console.log("");
console.log("✅ Production rollout verified: daemon_conversations is ready.");
