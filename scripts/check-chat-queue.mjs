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

const recent = await client.execute({
  sql: `SELECT id, status, created_at, started_at, completed_at, model,
               substr(error, 1, 200) as err
        FROM chat_tasks
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 8`,
  args: [userId],
});

console.log("Recent chat_tasks (newest first):");
for (const r of recent.rows) {
  const created = new Date(Number(r.created_at) * 1000).toLocaleTimeString("en-GB", { hour12: false });
  const started = r.started_at ? new Date(Number(r.started_at) * 1000).toLocaleTimeString("en-GB", { hour12: false }) : "—";
  const done = r.completed_at ? new Date(Number(r.completed_at) * 1000).toLocaleTimeString("en-GB", { hour12: false }) : "—";
  console.log(`  ${r.id.slice(0,8)} ${r.status.padEnd(10)} created=${created} started=${started} done=${done} model=${r.model || "?"}${r.err ? "  err="+r.err : ""}`);
}

const queued = await client.execute({
  sql: `SELECT count(*) as n FROM chat_tasks WHERE status IN ('queued', 'running') AND user_id = ?`,
  args: [userId],
});
console.log(`\nCurrently queued/running for this user: ${queued.rows[0].n}`);
