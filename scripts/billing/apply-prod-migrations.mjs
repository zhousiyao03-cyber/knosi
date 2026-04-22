// Apply the four billing migrations to production Turso.
// Usage:
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/billing/apply-prod-migrations.mjs
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const files = [
  "drizzle/0034_dazzling_exiles.sql",
  "drizzle/0035_ancient_jack_flag.sql",
  "drizzle/0036_worthless_stranger.sql",
  "drizzle/0037_third_changeling.sql",
];

for (const f of files) {
  console.log(`\n=== applying ${f} ===`);
  const raw = fs.readFileSync(f, "utf8");
  const statements = raw
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 90);
    try {
      await c.execute(stmt);
      console.log(`  ✅ ${preview}`);
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes("already exists") || msg.includes("duplicate column name")) {
        console.log(`  ⏭  ${preview} (already applied)`);
      } else {
        console.log(`  ❌ ${preview}\n     ${msg}`);
        throw err;
      }
    }
  }
}

console.log("\n=== all migrations applied ===");
