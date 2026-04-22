import { createClient } from "@libsql/client";
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

console.log("=== billing tables presence ===");
for (const t of ["subscriptions", "webhook_events", "note_images"]) {
  const r = await c.execute({ sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?", args: [t] });
  console.log(`  ${t}: ${r.rows.length ? "EXISTS" : "MISSING"}`);
}

console.log("\n=== users new columns ===");
const userCols = await c.execute("PRAGMA table_info(users)");
const colNames = userCols.rows.map(r => r.name);
for (const c of ["created_at", "ai_provider_preference"]) {
  console.log(`  ${c}: ${colNames.includes(c) ? "EXISTS" : "MISSING"}`);
}

console.log("\n=== migration log (drizzle-migrations) ===");
try {
  const r = await c.execute("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 5");
  for (const row of r.rows) console.log(`  ${row.id} ${row.hash?.slice(0, 16)} ${new Date(Number(row.created_at)).toISOString()}`);
} catch (e) {
  console.log("  no drizzle-migrations table (not used via drizzle-kit migrate)");
}

console.log("\n=== row counts ===");
for (const t of ["users", "notes", "subscriptions", "webhook_events"]) {
  try {
    const r = await c.execute(`SELECT COUNT(*) as n FROM ${t}`);
    console.log(`  ${t}: ${r.rows[0].n}`);
  } catch (e) {
    console.log(`  ${t}: (missing)`);
  }
}
