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

const args = process.argv.slice(2);
const taskId = args[0];
if (!taskId) {
  console.error("Usage: node scripts/check-chat-detail.mjs <task-id-prefix>");
  process.exit(1);
}

const r = await client.execute({
  sql: `SELECT id, status, total_text, error, messages FROM chat_tasks WHERE id LIKE ? || '%' LIMIT 1`,
  args: [taskId],
});

if (r.rows.length === 0) {
  console.log("not found");
  process.exit(0);
}

const row = r.rows[0];
console.log("id:", row.id);
console.log("status:", row.status);
console.log("total_text length:", row.total_text?.length ?? 0);
console.log("total_text preview:", (row.total_text ?? "").slice(0, 300));
console.log("error:", row.error?.slice(0, 300) ?? "(none)");
console.log("---");
console.log("messages JSON length:", row.messages?.length ?? 0);
const msgs = JSON.parse(row.messages);
console.log("messages count:", msgs.length);
for (let i = 0; i < msgs.length; i++) {
  const m = msgs[i];
  const c = m.content;
  let preview;
  if (typeof c === "string") {
    preview = `STRING(len=${c.length}) "${c.slice(0, 80)}"`;
  } else if (Array.isArray(c)) {
    preview = `PARTS[${c.length}] ` + c.map(p => `${p.type}(${(p.text ?? "").length}ch)`).join(",");
  } else {
    preview = `OTHER ${typeof c}`;
  }
  console.log(`  [${i}] role=${m.role} ${preview}`);
}
