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

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/clear-daemon-session.mjs <userId> [workerKey]");
  process.exit(1);
}
const workerKey = process.argv[3]; // optional — if omitted, clears all worker keys for this user

const before = await client.execute({
  sql: `SELECT user_id, worker_key, cli_session_id FROM daemon_conversations WHERE user_id = ?`,
  args: [userId],
});
console.log(`Before: ${before.rows.length} row(s)`);
for (const r of before.rows) {
  console.log(`  worker_key=${r.worker_key} session=${r.cli_session_id}`);
}

const result = workerKey
  ? await client.execute({
      sql: `DELETE FROM daemon_conversations WHERE user_id = ? AND worker_key = ?`,
      args: [userId, workerKey],
    })
  : await client.execute({
      sql: `DELETE FROM daemon_conversations WHERE user_id = ?`,
      args: [userId],
    });

console.log(`Deleted: ${result.rowsAffected} row(s)`);
