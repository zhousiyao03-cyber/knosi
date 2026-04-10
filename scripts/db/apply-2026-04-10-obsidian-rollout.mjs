/**
 * Production Turso rollout for Obsidian-style notes system.
 * Creates folders table, note_links table, and adds folderId to notes.
 *
 * Usage: set -a && source .env.turso-prod.local && set +a && node scripts/db/apply-2026-04-10-obsidian-rollout.mjs
 */
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  // 1. Create folders table
  `CREATE TABLE IF NOT EXISTS "folders" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "parent_id" text,
    "icon" text,
    "sort_order" integer NOT NULL DEFAULT 0,
    "collapsed" integer NOT NULL DEFAULT 0,
    "created_at" integer,
    "updated_at" integer
  )`,

  // 2. Indexes for folders
  `CREATE INDEX IF NOT EXISTS "folders_user_idx" ON "folders" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "folders_parent_idx" ON "folders" ("parent_id")`,

  // 3. Add folderId column to notes (if not exists)
  // SQLite doesn't have IF NOT EXISTS for ALTER TABLE ADD COLUMN,
  // so we catch the error if it already exists
  `ALTER TABLE "notes" ADD COLUMN "folder_id" text REFERENCES "folders"("id") ON DELETE SET NULL`,

  // 4. Index for notes.folder_id
  `CREATE INDEX IF NOT EXISTS "notes_folder_id_idx" ON "notes" ("folder_id")`,

  // 5. Create note_links table
  `CREATE TABLE IF NOT EXISTS "note_links" (
    "id" text PRIMARY KEY NOT NULL,
    "source_note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
    "target_note_id" text NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
    "target_title" text NOT NULL,
    "created_at" integer
  )`,

  // 6. Indexes for note_links
  `CREATE INDEX IF NOT EXISTS "note_links_source_idx" ON "note_links" ("source_note_id")`,
  `CREATE INDEX IF NOT EXISTS "note_links_target_idx" ON "note_links" ("target_note_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "note_links_pair_idx" ON "note_links" ("source_note_id", "target_note_id")`,
];

async function main() {
  console.log("Starting production rollout...\n");

  for (const sql of statements) {
    const label = sql.slice(0, 80).replace(/\n/g, " ");
    try {
      await client.execute(sql);
      console.log(`✅ ${label}...`);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        console.log(`⏭️  ${label}... (already exists, skipping)`);
      } else {
        console.error(`❌ ${label}...`);
        console.error(`   Error: ${msg}`);
      }
    }
  }

  // Verify
  console.log("\n--- Verification ---");
  const tables = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('folders', 'note_links') ORDER BY name`
  );
  console.log("Tables:", tables.rows.map((r) => r.name));

  const notesCols = await client.execute(`PRAGMA table_info(notes)`);
  const hasFolderId = notesCols.rows.some((r) => r.name === "folder_id");
  console.log(`notes.folder_id column: ${hasFolderId ? "✅" : "❌"}`);

  console.log("\nRollout complete!");
}

main().catch((err) => {
  console.error("Rollout failed:", err);
  process.exit(1);
});
