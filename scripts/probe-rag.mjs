import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("D:/repos/knosi/.env.turso-prod.local", "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)];
    })
);
process.env.TURSO_DATABASE_URL = env.TURSO_DATABASE_URL;
process.env.TURSO_AUTH_TOKEN = env.TURSO_AUTH_TOKEN;

const userId = "5dcad5a2-1d20-43df-818c-d640958ddb8a";
const query = process.argv[2] || "看到我最近的日子";
const scope = process.argv[3] || "all";

console.log(`Query: "${query}"  scope=${scope}  user=${userId.slice(0,8)}`);

const t0 = Date.now();
try {
  const { retrieveAgenticContext } = await import("../src/server/ai/agentic-rag.ts");
  const result = await retrieveAgenticContext(query, { userId, scope });
  console.log(`\n[${Date.now()-t0}ms] retrieved ${result.length} items`);
  for (const item of result.slice(0, 5)) {
    console.log(`  - ${item.sourceType}/${item.sourceId.slice(0,8)} score=${item.score?.toFixed(3) ?? "?"} "${(item.sourceTitle || "").slice(0,50)}"`);
    console.log(`    section: ${item.sectionPath?.join(" > ") ?? "(none)"}`);
    console.log(`    text: "${(item.content || "").slice(0,80)}..."`);
  }
} catch (err) {
  console.error(`[${Date.now()-t0}ms] ERROR:`, err.message);
  console.error(err.stack);
}
