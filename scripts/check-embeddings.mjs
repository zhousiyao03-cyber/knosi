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

const chunkCount = await client.execute({
  sql: `SELECT count(*) as n FROM knowledge_chunks WHERE user_id = ?`,
  args: [userId],
});
console.log(`knowledge_chunks for user: ${chunkCount.rows[0].n}`);

const embCount = await client.execute({
  sql: `SELECT count(*) as n FROM knowledge_chunk_embeddings e
        JOIN knowledge_chunks c ON c.id = e.chunk_id
        WHERE c.user_id = ?`,
  args: [userId],
});
console.log(`knowledge_chunk_embeddings for user: ${embCount.rows[0].n}`);

const sample = await client.execute({
  sql: `SELECT e.chunk_id, e.model, length(e.vector) as vec_bytes
        FROM knowledge_chunk_embeddings e
        JOIN knowledge_chunks c ON c.id = e.chunk_id
        WHERE c.user_id = ?
        LIMIT 3`,
  args: [userId],
});
console.log("Sample embeddings:");
for (const r of sample.rows) {
  console.log(`  chunk=${r.chunk_id?.slice(0,8)} model=${r.model} vec_bytes=${r.vec_bytes}`);
}

// Check chunks WITHOUT embeddings
const orphans = await client.execute({
  sql: `SELECT count(*) as n FROM knowledge_chunks c
        WHERE c.user_id = ?
        AND NOT EXISTS (SELECT 1 FROM knowledge_chunk_embeddings e WHERE e.chunk_id = c.id)`,
  args: [userId],
});
console.log(`chunks without embeddings: ${orphans.rows[0].n}`);
