#!/usr/bin/env node

/**
 * Production Turso rollout — curriculum B2.
 *
 *   1. ALTER curriculum_topic_notes ADD COLUMN source (default 'auto_substring')
 *   2. CREATE TABLE curriculum_topic_general_notes (with source)
 *   3. CREATE INDEX curriculum_topic_general_notes_note_idx
 *
 * Source: drizzle/0051_cool_crusher_hogan.sql.
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

console.log("Production Turso rollout — curriculum B2");
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
async function columnExists(table, column) {
  const r = await client.execute({ sql: `PRAGMA table_info('${table}')` });
  return r.rows.some((row) => row.name === column);
}

// 1) Add source column to existing curriculum_topic_notes
if (await tableExists("curriculum_topic_notes")) {
  if (!(await columnExists("curriculum_topic_notes", "source"))) {
    console.log("Adding source column to curriculum_topic_notes...");
    await client.execute(
      "ALTER TABLE curriculum_topic_notes ADD COLUMN source text DEFAULT 'auto_substring' NOT NULL"
    );
  } else {
    console.log("Skip — curriculum_topic_notes.source already exists.");
  }
} else {
  console.error("FAIL — curriculum_topic_notes table is missing; run B1 rollout first.");
  process.exit(1);
}

// 2) Create curriculum_topic_general_notes
if (!(await tableExists("curriculum_topic_general_notes"))) {
  console.log("Creating curriculum_topic_general_notes...");
  await client.execute(`
    CREATE TABLE curriculum_topic_general_notes (
      topic_id text NOT NULL,
      note_id text NOT NULL,
      source text DEFAULT 'auto_substring' NOT NULL,
      created_at integer,
      PRIMARY KEY (topic_id, note_id),
      FOREIGN KEY (topic_id) REFERENCES curriculum_topics(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — curriculum_topic_general_notes already exists.");
}

if (!(await indexExists("curriculum_topic_general_notes_note_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_topic_general_notes_note_idx ON curriculum_topic_general_notes (note_id)"
  );
}

console.log("");
console.log("Verification:");

if (!(await columnExists("curriculum_topic_notes", "source"))) {
  console.error("  FAIL — curriculum_topic_notes missing source column");
  process.exit(1);
}
console.log("  OK — curriculum_topic_notes.source");

if (!(await tableExists("curriculum_topic_general_notes"))) {
  console.error("  FAIL — curriculum_topic_general_notes missing");
  process.exit(1);
}
console.log("  OK — table curriculum_topic_general_notes");

if (!(await indexExists("curriculum_topic_general_notes_note_idx"))) {
  console.error("  FAIL — missing index curriculum_topic_general_notes_note_idx");
  process.exit(1);
}
console.log("  OK — index curriculum_topic_general_notes_note_idx");

console.log("");
console.log("✅ Production rollout verified: curriculum B2 schema is ready.");
