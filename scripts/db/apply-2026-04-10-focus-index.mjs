#!/usr/bin/env node
/**
 * Add composite index on activity_sessions(user_id, started_at) for
 * faster focus queries. Also verifies existing data.
 *
 * Usage:
 *   node scripts/db/apply-2026-04-10-focus-index.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

console.log(`Target: ${url}`);
console.log("");

// Apply index
const stmt =
  "CREATE INDEX IF NOT EXISTS activity_sessions_user_started_idx ON activity_sessions(user_id, started_at)";
process.stdout.write(`Creating index... `);
try {
  await client.execute(stmt);
  console.log("OK");
} catch (err) {
  const msg = err?.message ?? String(err);
  if (msg.includes("already exists")) {
    console.log("SKIP (already exists)");
  } else {
    console.log("FAIL");
    console.error(`  error: ${msg}`);
    process.exit(1);
  }
}

// Verify
console.log("");
console.log("Verifying...");
const idx = await client.execute({
  sql: `SELECT sql FROM sqlite_master WHERE name='activity_sessions_user_started_idx'`,
  args: [],
});
const idxSql = idx.rows[0]?.sql ?? "(not found)";
console.log(`  Index SQL: ${idxSql}`);

const count = await client.execute({
  sql: `SELECT COUNT(*) AS c FROM activity_sessions`,
  args: [],
});
console.log(`  Total activity_sessions rows: ${count.rows[0]?.c}`);

console.log("");
console.log("Done");
process.exit(0);
