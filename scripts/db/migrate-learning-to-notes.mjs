#!/usr/bin/env node
/**
 * Migrate learningNotes → notes table.
 * - learningTopics.title → notes.folder
 * - Preserves content, plainText, tags, timestamps
 * - Sets type = "note"
 *
 * Usage: node scripts/db/migrate-learning-to-notes.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function loadEnv(filePath) {
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
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

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 1. Fetch all learning topics
const topicsRes = await client.execute("SELECT id, title, user_id FROM learning_topics");
const topicMap = new Map();
for (const row of topicsRes.rows) {
  topicMap.set(row.id, { title: row.title, userId: row.user_id });
}
console.log(`Found ${topicMap.size} learning topics`);

// 2. Fetch all learning notes
const notesRes = await client.execute(
  "SELECT id, topic_id, user_id, title, content, plain_text, tags, ai_summary, created_at, updated_at FROM learning_notes"
);
console.log(`Found ${notesRes.rows.length} learning notes to migrate`);

if (notesRes.rows.length === 0) {
  console.log("Nothing to migrate.");
  client.close();
  process.exit(0);
}

// 3. Check for existing migrated notes (idempotency)
const existingRes = await client.execute(
  "SELECT id FROM notes WHERE folder IS NOT NULL"
);
const existingIds = new Set(existingRes.rows.map((r) => r.id));

let migrated = 0;
let skipped = 0;

for (const note of notesRes.rows) {
  if (existingIds.has(note.id)) {
    skipped++;
    continue;
  }

  const topic = topicMap.get(note.topic_id);
  const folder = topic?.title ?? "Uncategorized";

  await client.execute({
    sql: `INSERT INTO notes (id, user_id, title, content, plain_text, type, tags, folder, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'note', ?, ?, ?, ?)`,
    args: [
      note.id,
      note.user_id,
      note.title,
      note.content,
      note.plain_text,
      note.tags,
      folder,
      note.created_at,
      note.updated_at,
    ],
  });
  migrated++;
}

console.log(`\n✅ Migrated: ${migrated}`);
console.log(`⏭️  Skipped (already exist): ${skipped}`);

// 4. Verify
const verifyRes = await client.execute(
  "SELECT folder, count(*) as cnt FROM notes WHERE folder IS NOT NULL GROUP BY folder"
);
console.log("\nNotes by folder in production:");
for (const row of verifyRes.rows) {
  console.log(`  ${row.folder}: ${row.cnt} notes`);
}

client.close();
