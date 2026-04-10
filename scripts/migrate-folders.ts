/**
 * Data migration: convert flat notes.folder strings into folders table rows
 * and update notes.folderId to point to them.
 *
 * Usage: npx tsx scripts/migrate-folders.ts
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import path from "path";
import * as schema from "../src/server/db/schema";

const DEFAULT_SQLITE_DB_PATH = path.join("data", "second-brain.db");
const dbUrl =
  process.env.TURSO_DATABASE_URL ?? `file:${DEFAULT_SQLITE_DB_PATH}`;

const client = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

async function main() {
  console.log("Starting folder migration...");

  // 1. Find all distinct (userId, folder) pairs
  const distinctPairs = await db
    .select({
      userId: schema.notes.userId,
      folder: schema.notes.folder,
    })
    .from(schema.notes)
    .where(isNotNull(schema.notes.folder))
    .groupBy(schema.notes.userId, schema.notes.folder);

  console.log(`Found ${distinctPairs.length} distinct (user, folder) pairs`);

  let created = 0;
  let updated = 0;

  for (const pair of distinctPairs) {
    if (!pair.folder) continue;

    // 2. Check if a folders row already exists
    const [existing] = await db
      .select({ id: schema.folders.id })
      .from(schema.folders)
      .where(
        and(
          eq(schema.folders.userId, pair.userId),
          eq(schema.folders.name, pair.folder),
          sql`${schema.folders.parentId} is null`
        )
      )
      .limit(1);

    let folderId: string;

    if (existing) {
      folderId = existing.id;
    } else {
      // 3. Create the folder
      folderId = crypto.randomUUID();
      await db.insert(schema.folders).values({
        id: folderId,
        userId: pair.userId,
        name: pair.folder,
        parentId: null,
        sortOrder: created,
      });
      created++;
    }

    // 4. Update notes.folderId for matching notes
    await db
      .update(schema.notes)
      .set({ folderId })
      .where(
        and(
          eq(schema.notes.userId, pair.userId),
          eq(schema.notes.folder, pair.folder),
          sql`${schema.notes.folderId} is null`
        )
      );

    updated++;
  }

  console.log(`Created ${created} folders`);
  console.log(`Updated ${updated} folder groups`);
  console.log("Migration complete!");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
