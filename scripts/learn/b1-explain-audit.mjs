#!/usr/bin/env node
/**
 * B1-4 — EXPLAIN QUERY PLAN 体检
 *
 * 对 Second Brain 里高频跑的查询做一次 "EXPLAIN QUERY PLAN" 扫描,
 * 打印每条查询的 SQLite 查询计划,把 "TEMP B-TREE FOR ORDER BY"
 * 这类能暴露 index gap 的输出拎出来。输出用于指导 B1-5 补索引。
 *
 * 运行:
 *   node scripts/learn/b1-explain-audit.mjs
 *
 * 输出格式:
 *   ━━━ <label>
 *     <每一行 EXPLAIN 结果>
 *     [verdict]
 *
 * 不改任何数据,只读 sqlite_master / 跑 EXPLAIN,可重复跑。
 */

import { createClient } from "@libsql/client";

const DB_URL = process.env.SQLITE_DB_PATH
  ? `file:${process.env.SQLITE_DB_PATH}`
  : "file:data/second-brain.db";

const client = createClient({ url: DB_URL });

/** 每一项代表一个被审计的查询。 */
const queries = [
  {
    label: "notes.list (default order by updated_at)",
    sql: `SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30`,
    args: ["u"],
  },
  {
    label: "notes.list + folder filter",
    sql: `SELECT * FROM notes WHERE user_id = ? AND folder_id = ? ORDER BY updated_at DESC LIMIT 30`,
    args: ["u", "f"],
  },
  {
    label: "notes search LIKE",
    sql: `SELECT id, title FROM notes WHERE user_id = ? AND (title LIKE ? OR plain_text LIKE ?) LIMIT 5`,
    args: ["u", "%x%", "%x%"],
  },
  {
    label: "bookmarks.list (default order by created_at)",
    sql: `SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
    args: ["u"],
  },
  {
    label: "todos.list filtered by status",
    sql: `SELECT * FROM todos WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 30`,
    args: ["u", "todo"],
  },
  {
    label: "todos due today",
    sql: `SELECT * FROM todos WHERE due_date >= ? AND due_date < ? AND user_id = ? ORDER BY due_date ASC, updated_at DESC LIMIT 5`,
    args: [0, 1, "u"],
  },
  {
    label: "folders.list ordered by sort_order",
    sql: `SELECT * FROM folders WHERE user_id = ? ORDER BY sort_order ASC`,
    args: ["u"],
  },
  {
    label: "dashboard: count notes by user",
    sql: `SELECT count(*) FROM notes WHERE user_id = ?`,
    args: ["u"],
  },
  {
    label: "dashboard: count todos done",
    sql: `SELECT count(*) FROM todos WHERE status = 'done' AND user_id = ?`,
    args: ["u"],
  },
  {
    label: "queue: snapshot group by status",
    sql: `SELECT status, count(*) FROM knowledge_index_jobs GROUP BY status`,
    args: [],
  },
  {
    label: "queue: claimNextJob subquery (the B1-1 rewrite)",
    sql: `UPDATE knowledge_index_jobs
          SET status='running'
          WHERE id=(SELECT id FROM knowledge_index_jobs
                    WHERE status='pending' AND queued_at<=?
                    ORDER BY queued_at ASC LIMIT 1)
          RETURNING *`,
    args: [0],
  },
  {
    label: "queue: pending by queued_at (the SELECT inside)",
    sql: `SELECT * FROM knowledge_index_jobs WHERE status='pending' AND queued_at <= ? ORDER BY queued_at ASC LIMIT 1`,
    args: [0],
  },
  {
    label: "learning_notes group by topic_id (batch path)",
    sql: `SELECT topic_id, count(*) FROM learning_notes WHERE user_id = ? GROUP BY topic_id`,
    args: ["u"],
  },
  {
    label: "portfolio_holdings by user",
    sql: `SELECT * FROM portfolio_holdings WHERE user_id = ? ORDER BY symbol ASC`,
    args: ["u"],
  },
  {
    label: "activity_sessions daily range (focus)",
    sql: `SELECT * FROM activity_sessions WHERE user_id = ? AND started_at < ? AND ended_at > ? ORDER BY started_at`,
    args: ["u", 0, 0],
  },
  {
    label: "note_links backlinks",
    sql: `SELECT nl.source_note_id, n.title FROM note_links nl JOIN notes n ON nl.source_note_id = n.id WHERE nl.target_note_id = ?`,
    args: ["n"],
  },
  {
    label: "token_usage_entries recent by user",
    sql: `SELECT * FROM token_usage_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    args: ["u"],
  },
  {
    label: "knowledge_chunks by source",
    sql: `SELECT * FROM knowledge_chunks WHERE source_type = ? AND source_id = ?`,
    args: ["note", "id"],
  },
];

/** 看一条 plan 行的 detail,判断"健康度"。 */
function classifyPlan(lines) {
  const joined = lines.join(" ");
  const warnings = [];

  if (/USE TEMP B-TREE FOR ORDER BY/.test(joined)) {
    warnings.push("file-sort on ORDER BY (index covers WHERE but not ordering)");
  }
  if (/USE TEMP B-TREE FOR GROUP BY/.test(joined)) {
    warnings.push("file-sort on GROUP BY");
  }
  if (/USE TEMP B-TREE FOR RIGHT PART OF ORDER BY/.test(joined)) {
    warnings.push("partial file-sort (first ORDER BY key uses index, rest does not)");
  }
  // "SCAN foo" without any index is a true full table scan.
  // "SCAN foo USING COVERING INDEX ..." is fine — SQLite walks the
  // whole index because the query has no WHERE clause (e.g.
  // GROUP BY status over all rows), and a covering-index walk is
  // much cheaper than a table scan.
  //
  // Avoid the regex backtracking trap: drop every "SCAN <table>
  // USING [COVERING] INDEX ..." phrase first, then look for any
  // remaining "SCAN".
  const sanitized = joined.replace(
    /SCAN\s+\S+\s+USING\s+(COVERING\s+)?INDEX\s+\S+/g,
    ""
  );
  if (/\bSCAN\s+\S+/.test(sanitized)) {
    warnings.push("full table scan");
  }
  if (/LIKE/.test(joined)) {
    // LIKE by itself is fine, but worth noting when it appears in a plan
    // together with no index use on the LIKEd column.
  }

  if (/COVERING INDEX/.test(joined) && warnings.length === 0) {
    return { level: "ok", note: "covering index, no warnings" };
  }
  if (warnings.length === 0) {
    return { level: "ok", note: "uses index, no warnings" };
  }
  return { level: "warn", note: warnings.join("; ") };
}

console.log(`B1-4 — EXPLAIN QUERY PLAN audit`);
console.log(`db = ${DB_URL}`);
console.log("");

const rows = [];

for (const q of queries) {
  console.log(`━━━ ${q.label}`);
  try {
    const result = await client.execute({
      sql: `EXPLAIN QUERY PLAN ${q.sql}`,
      args: q.args,
    });
    const lines = result.rows.map((row) => String(row.detail ?? ""));
    for (const line of lines) console.log("  " + line);
    const verdict = classifyPlan(lines);
    console.log(`  → ${verdict.level === "ok" ? "✓" : "⚠"}  ${verdict.note}`);
    rows.push({ label: q.label, ...verdict });
  } catch (err) {
    console.log("  ERROR: " + (err?.message ?? err));
    rows.push({ label: q.label, level: "error", note: String(err?.message ?? err) });
  }
  console.log("");
}

console.log("──────── summary ────────");
const warns = rows.filter((r) => r.level === "warn");
const oks = rows.filter((r) => r.level === "ok");
const errors = rows.filter((r) => r.level === "error");
console.log(`  ok:      ${oks.length}`);
console.log(`  warn:    ${warns.length}`);
console.log(`  error:   ${errors.length}`);
if (warns.length > 0) {
  console.log("");
  console.log("Queries that need an index fix (candidates for B1-5):");
  for (const w of warns) {
    console.log(`  - ${w.label}`);
    console.log(`      ${w.note}`);
  }
}

client.close();
