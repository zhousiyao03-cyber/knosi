import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("D:/repos/knosi/.env.turso-prod.local", "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
    })
);

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const userId = "5dcad5a2-1d20-43df-818c-d640958ddb8a";

// 1) Note count by type
const byType = await client.execute({
  sql: `SELECT type, count(*) as n FROM notes WHERE user_id = ? GROUP BY type ORDER BY n DESC`,
  args: [userId],
});
console.log("Notes by type:");
for (const r of byType.rows) console.log(`  ${(r.type || "(null)").padEnd(15)} ${r.n}`);

// 2) Largest notes by content size (proxy for list-payload bloat)
const big = await client.execute({
  sql: `SELECT id, title, length(content) as content_len, length(plain_text) as plain_len
        FROM notes
        WHERE user_id = ?
        ORDER BY length(content) DESC
        LIMIT 8`,
  args: [userId],
});
console.log("\nLargest notes (content size):");
for (const r of big.rows) {
  console.log(`  ${String(r.content_len).padStart(8)}b  ${(r.title || "").slice(0, 60)}`);
}

// 3) Total payload size if list selects everything
const total = await client.execute({
  sql: `SELECT count(*) as n, sum(length(content)) as content_bytes, sum(length(plain_text)) as plain_bytes
        FROM notes WHERE user_id = ?`,
  args: [userId],
});
const t = total.rows[0];
console.log(`\nTotal: ${t.n} notes, content ${(Number(t.content_bytes)/1024).toFixed(0)} KB, plainText ${(Number(t.plain_bytes)/1024).toFixed(0)} KB`);
