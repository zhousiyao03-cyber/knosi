import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("D:/repos/knosi/.env.turso-prod.local", "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)];
    })
);

const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const userId = "5dcad5a2-1d20-43df-818c-d640958ddb8a";

// Check the most recent notes' content
const noteIds = ["1f8b0065","3449f96c","2f09d36f","f2d740b0"];
for (const idPrefix of noteIds) {
  const r = await client.execute({
    sql: `SELECT id, title, length(content) as content_len, length(plain_text) as plain_len,
                 substr(plain_text, 1, 120) as plain_preview, updated_at
          FROM notes WHERE user_id = ? AND id LIKE ? || '%' LIMIT 1`,
    args: [userId, idPrefix],
  });
  if (r.rows.length === 0) { console.log(`${idPrefix}: not found`); continue; }
  const n = r.rows[0];
  console.log(`${n.id.slice(0,8)} "${(n.title || "").slice(0,40)}"`);
  console.log(`  content_len=${n.content_len} plain_text_len=${n.plain_len}`);
  console.log(`  plain_preview: "${(n.plain_preview ?? "").slice(0,120)}"`);
}

// Check knowledge_index_jobs for these notes
console.log("\n--- knowledge_index_jobs ---");
const jobs = await client.execute({
  sql: `SELECT id, source_id, source_type, reason, status, error,
               created_at, finished_at
        FROM knowledge_index_jobs
        WHERE source_id IN (SELECT id FROM notes WHERE user_id = ?)
        ORDER BY created_at DESC LIMIT 15`,
  args: [userId],
});
for (const j of jobs.rows) {
  const created = j.created_at ? new Date(Number(j.created_at) * 1000).toLocaleTimeString("en-GB", { hour12: false }) : "?";
  console.log(`  ${j.id.slice(0,8)} src=${j.source_id?.slice(0,8)} status=${j.status} reason=${j.reason} created=${created} err=${(j.error || "").slice(0,80)}`);
}
