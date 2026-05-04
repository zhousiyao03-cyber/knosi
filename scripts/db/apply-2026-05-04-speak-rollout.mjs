#!/usr/bin/env node

/**
 * Production Turso rollout — speak (shadow drill).
 *
 * Creates one new table for the speak module:
 *   speak_sentence_practice — composite PK (user_id, sentence_id)
 *
 * Source: drizzle/0048_lame_miss_america.sql.
 *
 * Idempotent: detects existing table and skips creation; always runs the
 * verification queries at the end.
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

console.log("Production Turso rollout — speak (shadow drill)");
console.log(`Target: ${url}`);
console.log("");

async function tableExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

if (!(await tableExists("speak_sentence_practice"))) {
  console.log("Creating speak_sentence_practice...");
  await client.execute(`
    CREATE TABLE speak_sentence_practice (
      user_id text NOT NULL,
      sentence_id text NOT NULL,
      count integer NOT NULL DEFAULT 0,
      last_practiced_at integer NOT NULL,
      PRIMARY KEY (user_id, sentence_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — speak_sentence_practice already exists.");
}

console.log("");
console.log("Verification:");

if (!(await tableExists("speak_sentence_practice"))) {
  console.error("  FAIL — missing table speak_sentence_practice");
  process.exit(1);
}
console.log("  OK — table speak_sentence_practice exists");

const fkResult = await client.execute({
  sql: `PRAGMA foreign_key_list('speak_sentence_practice')`,
});
const usersFk = fkResult.rows.find((r) => r.table === "users");
if (!usersFk) {
  console.error("  FAIL — speak_sentence_practice missing FK to users(id)");
  process.exit(1);
}
if (usersFk.on_delete !== "CASCADE") {
  console.error(
    `  FAIL — speak_sentence_practice.user_id FK on_delete is ${usersFk.on_delete}, expected CASCADE`,
  );
  process.exit(1);
}
console.log("  OK — speak_sentence_practice.user_id → users(id) ON DELETE CASCADE");

const pkResult = await client.execute({
  sql: `PRAGMA table_info('speak_sentence_practice')`,
});
const pkCols = pkResult.rows
  .filter((r) => r.pk > 0)
  .sort((a, b) => Number(a.pk) - Number(b.pk))
  .map((r) => r.name);
if (pkCols.join(",") !== "user_id,sentence_id") {
  console.error(
    `  FAIL — composite PK columns are ${pkCols.join(",") || "(none)"}, expected user_id,sentence_id`,
  );
  process.exit(1);
}
console.log("  OK — composite PK (user_id, sentence_id)");

console.log("");
console.log("✅ Production rollout verified: speak schema is ready.");
