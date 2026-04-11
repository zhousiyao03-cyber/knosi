/**
 * Production data consolidation: organize all notes into proper folders
 * and inject os_project_notes (source reading) into the unified notes system.
 *
 * What this does:
 * 1. Create missing folders from legacy notes.folder strings (Golang, Rust, 计算机基础, 微服务架构)
 * 2. Create "源码阅读" folder for project analysis notes
 * 3. Migrate all notes with legacy `folder` string to proper `folderId`
 * 4. Copy os_project_notes into notes table under "源码阅读" folder
 *
 * Usage: set -a && source .env.turso-prod.local && set +a && node scripts/db/apply-2026-04-11-consolidate-notes.mjs
 */
import { createClient } from "@libsql/client";
import crypto from "crypto";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function exec(sql, args = []) {
  return client.execute({ sql, args });
}

async function main() {
  console.log("Starting notes consolidation...\n");

  // Step 0: Get the primary userId (the one with the most notes)
  const userRow = await exec(
    "SELECT user_id as id, COUNT(*) as c FROM notes GROUP BY user_id ORDER BY c DESC LIMIT 1"
  );
  if (userRow.rows.length === 0) {
    console.log("No notes found, skipping.");
    return;
  }
  const userId = userRow.rows[0].id;
  console.log(`User: ${userId}\n`);

  // Step 1: Get existing folders
  const existingFolders = await exec(
    "SELECT id, name, parent_id FROM folders WHERE user_id = ?",
    [userId]
  );
  const folderMap = new Map(existingFolders.rows.map((f) => [f.name, f.id]));
  console.log(`Existing folders: ${[...folderMap.keys()].join(", ")}`);

  // Step 2: Find all legacy folder names that don't have a proper folder yet
  const legacyFolders = await exec(
    "SELECT DISTINCT folder FROM notes WHERE user_id = ? AND folder IS NOT NULL AND folder_id IS NULL",
    [userId]
  );
  console.log(
    `Legacy folder names to migrate: ${legacyFolders.rows.map((r) => r.folder).join(", ")}`
  );

  // Step 3: Create folders for any legacy names that don't exist yet
  let sortOrder = existingFolders.rows.length;
  for (const row of legacyFolders.rows) {
    const name = row.folder;
    if (!folderMap.has(name)) {
      const id = crypto.randomUUID();
      await exec(
        "INSERT INTO folders (id, user_id, name, parent_id, sort_order, collapsed, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, 0, unixepoch(), unixepoch())",
        [id, userId, name, sortOrder++]
      );
      folderMap.set(name, id);
      console.log(`  ✅ Created folder: "${name}" (${id})`);
    } else {
      console.log(`  ⏭️  Folder "${name}" already exists`);
    }
  }

  // Step 4: Create "源码阅读" folder if not exists
  if (!folderMap.has("源码阅读")) {
    const id = crypto.randomUUID();
    await exec(
      "INSERT INTO folders (id, user_id, name, parent_id, sort_order, collapsed, created_at, updated_at) VALUES (?, ?, '源码阅读', NULL, ?, 0, unixepoch(), unixepoch())",
      [id, userId, sortOrder++]
    );
    folderMap.set("源码阅读", id);
    console.log(`  ✅ Created folder: "源码阅读" (${id})`);
  }

  // Step 5: Create "每日计划" folder if not exists (for journals)
  if (!folderMap.has("每日计划")) {
    const id = crypto.randomUUID();
    await exec(
      "INSERT INTO folders (id, user_id, name, parent_id, sort_order, collapsed, created_at, updated_at) VALUES (?, ?, '每日计划', NULL, ?, 0, unixepoch(), unixepoch())",
      [id, userId, sortOrder++]
    );
    folderMap.set("每日计划", id);
    console.log(`  ✅ Created folder: "每日计划" (${id})`);
  }

  console.log(`\nFinal folder map: ${JSON.stringify(Object.fromEntries(folderMap), null, 2)}\n`);

  // Step 6: Migrate legacy notes.folder → notes.folderId
  let migratedCount = 0;
  for (const [name, folderId] of folderMap) {
    const result = await exec(
      "UPDATE notes SET folder_id = ? WHERE user_id = ? AND folder = ? AND folder_id IS NULL",
      [folderId, userId, name]
    );
    if (result.rowsAffected > 0) {
      console.log(`  ✅ Migrated ${result.rowsAffected} notes from folder="${name}" → folderId=${folderId}`);
      migratedCount += result.rowsAffected;
    }
  }
  console.log(`Total notes migrated: ${migratedCount}`);

  // Step 7: Assign unassigned journals to "每日计划"
  const dailyFolderId = folderMap.get("每日计划");
  if (dailyFolderId) {
    const result = await exec(
      "UPDATE notes SET folder_id = ? WHERE user_id = ? AND type = 'journal' AND folder_id IS NULL",
      [dailyFolderId, userId]
    );
    if (result.rowsAffected > 0) {
      console.log(`  ✅ Assigned ${result.rowsAffected} journals to "每日计划"`);
    }
  }

  // Step 8: Copy os_project_notes into notes table under "源码阅读"
  const sourceReadingFolderId = folderMap.get("源码阅读");
  const projectNotes = await exec(
    `SELECT n.id, n.project_id, n.user_id, n.title, n.content, n.plain_text, n.tags,
            n.share_token, n.shared_at, n.note_type, n.created_at, n.updated_at,
            p.name as project_name, p.repo_url
     FROM os_project_notes n
     JOIN os_projects p ON p.id = n.project_id
     WHERE n.user_id = ?
     ORDER BY n.updated_at DESC`,
    [userId]
  );

  console.log(`\nSource reading notes to inject: ${projectNotes.rows.length}`);

  let injectedCount = 0;
  for (const pn of projectNotes.rows) {
    // Check if already injected (by matching title)
    const existing = await exec(
      "SELECT id FROM notes WHERE user_id = ? AND title = ? AND folder_id = ?",
      [userId, pn.title, sourceReadingFolderId]
    );
    if (existing.rows.length > 0) {
      console.log(`  ⏭️  "${pn.title}" already exists in notes`);
      continue;
    }

    const noteId = crypto.randomUUID();
    // Add project metadata as tags
    const existingTags = (() => {
      try { return JSON.parse(pn.tags || "[]"); } catch { return []; }
    })();
    const tags = [...new Set([...existingTags, "源码阅读", pn.project_name])];

    await exec(
      `INSERT INTO notes (id, user_id, title, content, plain_text, type, tags, folder_id, share_token, shared_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'note', ?, ?, ?, ?, ?, ?)`,
      [
        noteId,
        userId,
        pn.title,
        pn.content,
        pn.plain_text,
        JSON.stringify(tags),
        sourceReadingFolderId,
        pn.share_token,
        pn.shared_at,
        pn.created_at,
        pn.updated_at,
      ]
    );
    injectedCount++;
    console.log(`  ✅ Injected: "${pn.title}" → 源码阅读`);
  }
  console.log(`Total source reading notes injected: ${injectedCount}`);

  // Verification
  console.log("\n--- Verification ---");
  const folderCounts = await exec(
    `SELECT f.name, COUNT(n.id) as count
     FROM folders f
     LEFT JOIN notes n ON n.folder_id = f.id
     WHERE f.user_id = ?
     GROUP BY f.id
     ORDER BY f.sort_order`,
    [userId]
  );
  for (const row of folderCounts.rows) {
    console.log(`  ${row.name}: ${row.count} notes`);
  }

  const unfiled = await exec(
    "SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND folder_id IS NULL",
    [userId]
  );
  console.log(`  (unfiled): ${unfiled.rows[0].count} notes`);

  console.log("\nConsolidation complete!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
