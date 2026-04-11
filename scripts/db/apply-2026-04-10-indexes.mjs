#!/usr/bin/env node
/**
 * 2026-04-10 索引迁移脚本
 *
 * 新增索引：
 *   1. portfolio_holdings_user_symbol_idx (user_id, symbol) — 加速按 symbol 查持仓
 *   2. portfolio_news_user_symbol_idx (user_id, symbol) — 加速按 symbol 查新闻
 *   3. todos_user_duedate_status_idx (user_id, due_date, status) — 加速 Dashboard 今日待办查询
 *
 * 用法：
 *   node scripts/db/apply-2026-04-10-indexes.mjs           # 本地
 *   set -a && source .env.turso-prod.local && set +a && node scripts/db/apply-2026-04-10-indexes.mjs  # 生产
 *
 * 回滚：
 *   node scripts/db/apply-2026-04-10-indexes.mjs --rollback
 */

import { createClient } from "@libsql/client";

const isRollback = process.argv.includes("--rollback");

const url = process.env.TURSO_DATABASE_URL ?? "file:data/second-brain.db";
const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const INDEXES = [
  {
    name: "portfolio_holdings_user_symbol_idx",
    create: `CREATE INDEX IF NOT EXISTS portfolio_holdings_user_symbol_idx ON portfolio_holdings (user_id, symbol)`,
    drop: `DROP INDEX IF EXISTS portfolio_holdings_user_symbol_idx`,
  },
  {
    name: "portfolio_news_user_symbol_idx",
    create: `CREATE INDEX IF NOT EXISTS portfolio_news_user_symbol_idx ON portfolio_news (user_id, symbol)`,
    drop: `DROP INDEX IF EXISTS portfolio_news_user_symbol_idx`,
  },
  {
    name: "todos_user_duedate_status_idx",
    create: `CREATE INDEX IF NOT EXISTS todos_user_duedate_status_idx ON todos (user_id, due_date, status)`,
    drop: `DROP INDEX IF EXISTS todos_user_duedate_status_idx`,
  },
];

async function main() {
  console.log(`📦 目标数据库: ${url.startsWith("libsql://") ? "(Turso 生产)" : url}`);
  console.log(`📋 操作: ${isRollback ? "回滚（删除索引）" : "创建索引"}`);
  console.log("");

  for (const idx of INDEXES) {
    const sql = isRollback ? idx.drop : idx.create;
    try {
      await client.execute(sql);
      console.log(`  ✅ ${isRollback ? "已删除" : "已创建"}: ${idx.name}`);
    } catch (err) {
      console.error(`  ❌ 失败: ${idx.name} — ${err.message}`);
    }
  }

  // 验证：列出当前索引
  console.log("\n📊 验证 — 当前相关索引：");
  const result = await client.execute(
    `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND (tbl_name='portfolio_holdings' OR tbl_name='portfolio_news' OR tbl_name='todos') ORDER BY tbl_name, name`
  );
  for (const row of result.rows) {
    console.log(`  ${row.tbl_name}.${row.name}`);
  }

  client.close();
  console.log("\n✅ 迁移完成");
}

main().catch((err) => {
  console.error("❌ 迁移失败:", err);
  process.exit(1);
});
