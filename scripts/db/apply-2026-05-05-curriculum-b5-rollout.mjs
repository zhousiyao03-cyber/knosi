#!/usr/bin/env node

/**
 * Production Turso rollout — curriculum B5.
 *   curriculum_mastery_log  — audit trail for mastery state changes
 *   curriculum_audits       — saved LLM gap-analysis runs
 *
 * Source: drizzle/0052_dazzling_vision.sql.
 * Idempotent.
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

console.log("Production Turso rollout — curriculum B5");
console.log(`Target: ${url}`);
console.log("");

async function tableExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [name],
  });
  return r.rows.length > 0;
}
async function indexExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
    args: [name],
  });
  return r.rows.length > 0;
}

if (!(await tableExists("curriculum_mastery_log"))) {
  console.log("Creating curriculum_mastery_log...");
  await client.execute(`
    CREATE TABLE curriculum_mastery_log (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      topic_id text NOT NULL,
      mastery text NOT NULL,
      changed_at integer,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (topic_id) REFERENCES curriculum_topics(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — curriculum_mastery_log already exists.");
}
if (!(await indexExists("curriculum_mastery_log_user_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_mastery_log_user_idx ON curriculum_mastery_log (user_id, changed_at)"
  );
}
if (!(await indexExists("curriculum_mastery_log_topic_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_mastery_log_topic_idx ON curriculum_mastery_log (topic_id)"
  );
}

if (!(await tableExists("curriculum_audits"))) {
  console.log("Creating curriculum_audits...");
  await client.execute(`
    CREATE TABLE curriculum_audits (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      track_id text NOT NULL,
      summary text NOT NULL,
      strengths text NOT NULL,
      weak_areas text NOT NULL,
      missing_must_knows text NOT NULL,
      next_steps text NOT NULL,
      created_at integer,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (track_id) REFERENCES curriculum_tracks(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — curriculum_audits already exists.");
}
if (!(await indexExists("curriculum_audits_user_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_audits_user_idx ON curriculum_audits (user_id, created_at)"
  );
}
if (!(await indexExists("curriculum_audits_track_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_audits_track_idx ON curriculum_audits (track_id)"
  );
}

console.log("");
console.log("Verification:");
for (const t of ["curriculum_mastery_log", "curriculum_audits"]) {
  if (!(await tableExists(t))) {
    console.error(`  FAIL — missing table ${t}`);
    process.exit(1);
  }
  console.log(`  OK — table ${t}`);
}
for (const i of [
  "curriculum_mastery_log_user_idx",
  "curriculum_mastery_log_topic_idx",
  "curriculum_audits_user_idx",
  "curriculum_audits_track_idx",
]) {
  if (!(await indexExists(i))) {
    console.error(`  FAIL — missing index ${i}`);
    process.exit(1);
  }
  console.log(`  OK — index ${i}`);
}

console.log("");
console.log("✅ Production rollout verified: curriculum B5 schema is ready.");
