#!/usr/bin/env node

/**
 * Production Turso rollout — curriculum map.
 *
 * Creates four new tables:
 *   curriculum_tracks          — per-user role tracks (e.g. AI Engineer)
 *   curriculum_areas           — areas grouped under a track
 *   curriculum_topics          — leaf knowledge points with mastery state
 *   curriculum_topic_notes     — many-to-many topic ↔ learning_notes
 *
 * Source: drizzle/0050_tidy_killraven.sql.
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

console.log("Production Turso rollout — curriculum map");
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

// 1. curriculum_tracks
if (!(await tableExists("curriculum_tracks"))) {
  console.log("Creating curriculum_tracks...");
  await client.execute(`
    CREATE TABLE curriculum_tracks (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      title text NOT NULL,
      description text,
      icon text,
      order_index integer DEFAULT 0 NOT NULL,
      created_at integer,
      updated_at integer,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — curriculum_tracks already exists.");
}
if (!(await indexExists("curriculum_tracks_user_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_tracks_user_idx ON curriculum_tracks (user_id, order_index)"
  );
}

// 2. curriculum_areas
if (!(await tableExists("curriculum_areas"))) {
  console.log("Creating curriculum_areas...");
  await client.execute(`
    CREATE TABLE curriculum_areas (
      id text PRIMARY KEY NOT NULL,
      track_id text NOT NULL,
      title text NOT NULL,
      description text,
      order_index integer DEFAULT 0 NOT NULL,
      created_at integer,
      updated_at integer,
      FOREIGN KEY (track_id) REFERENCES curriculum_tracks(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — curriculum_areas already exists.");
}
if (!(await indexExists("curriculum_areas_track_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_areas_track_idx ON curriculum_areas (track_id, order_index)"
  );
}

// 3. curriculum_topics
if (!(await tableExists("curriculum_topics"))) {
  console.log("Creating curriculum_topics...");
  await client.execute(`
    CREATE TABLE curriculum_topics (
      id text PRIMARY KEY NOT NULL,
      area_id text NOT NULL,
      parent_id text,
      title text NOT NULL,
      description text,
      mastery text DEFAULT 'blank' NOT NULL,
      order_index integer DEFAULT 0 NOT NULL,
      created_at integer,
      updated_at integer,
      FOREIGN KEY (area_id) REFERENCES curriculum_areas(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (parent_id) REFERENCES curriculum_topics(id) ON UPDATE no action ON DELETE set null
    )
  `);
} else {
  console.log("Skip — curriculum_topics already exists.");
}
if (!(await indexExists("curriculum_topics_area_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_topics_area_idx ON curriculum_topics (area_id, order_index)"
  );
}
if (!(await indexExists("curriculum_topics_parent_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_topics_parent_idx ON curriculum_topics (area_id, parent_id)"
  );
}

// 4. curriculum_topic_notes
if (!(await tableExists("curriculum_topic_notes"))) {
  console.log("Creating curriculum_topic_notes...");
  await client.execute(`
    CREATE TABLE curriculum_topic_notes (
      topic_id text NOT NULL,
      note_id text NOT NULL,
      created_at integer,
      PRIMARY KEY (topic_id, note_id),
      FOREIGN KEY (topic_id) REFERENCES curriculum_topics(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (note_id) REFERENCES learning_notes(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — curriculum_topic_notes already exists.");
}
if (!(await indexExists("curriculum_topic_notes_note_idx"))) {
  await client.execute(
    "CREATE INDEX curriculum_topic_notes_note_idx ON curriculum_topic_notes (note_id)"
  );
}

console.log("");
console.log("Verification:");

const expectedTables = [
  "curriculum_tracks",
  "curriculum_areas",
  "curriculum_topics",
  "curriculum_topic_notes",
];

for (const t of expectedTables) {
  if (!(await tableExists(t))) {
    console.error(`  FAIL — missing table ${t}`);
    process.exit(1);
  }
  console.log(`  OK — table ${t} exists`);
}

const expectedIndexes = [
  "curriculum_tracks_user_idx",
  "curriculum_areas_track_idx",
  "curriculum_topics_area_idx",
  "curriculum_topics_parent_idx",
  "curriculum_topic_notes_note_idx",
];

for (const idx of expectedIndexes) {
  if (!(await indexExists(idx))) {
    console.error(`  FAIL — missing index ${idx}`);
    process.exit(1);
  }
  console.log(`  OK — index ${idx} exists`);
}

console.log("");
console.log("✅ Production rollout verified: curriculum schema is ready.");
