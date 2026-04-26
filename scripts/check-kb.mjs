import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("D:/repos/knosi/.env.turso-prod.local", "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)];
    })
);

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const userId = "5dcad5a2-1d20-43df-818c-d640958ddb8a";

const chunks = await client.execute({
  sql: `SELECT source_type, count(*) as n FROM knowledge_chunks WHERE user_id = ? GROUP BY source_type`,
  args: [userId],
});
console.log("knowledge_chunks by source_type:");
let total = 0;
for (const r of chunks.rows) {
  console.log(`  ${r.source_type}: ${r.n}`);
  total += Number(r.n);
}
console.log(`  TOTAL: ${total}`);

const notes = await client.execute({
  sql: `SELECT count(*) as n FROM notes WHERE user_id = ?`,
  args: [userId],
});
console.log(`\nnotes table: ${notes.rows[0].n}`);

const recent = await client.execute({
  sql: `SELECT id, substr(title, 1, 40) as title, updated_at
        FROM notes WHERE user_id = ?
        ORDER BY updated_at DESC LIMIT 5`,
  args: [userId],
});
console.log("\nrecent notes:");
for (const r of recent.rows) {
  const ts = r.updated_at ? new Date(Number(r.updated_at) * 1000).toLocaleString("en-GB", { hour12: false }) : "?";
  console.log(`  ${r.id.slice(0,8)} ${ts}  "${r.title}"`);
}

// Cross-check: are there chunks for these notes?
console.log("\nchunks per recent note:");
for (const note of recent.rows) {
  const c = await client.execute({
    sql: `SELECT count(*) as n FROM knowledge_chunks WHERE user_id = ? AND source_type = 'note' AND source_id = ?`,
    args: [userId, note.id],
  });
  console.log(`  ${note.id.slice(0,8)} "${note.title}" → ${c.rows[0].n} chunks`);
}
