#!/usr/bin/env node
/**
 * EXPLAIN QUERY PLAN 分析脚本
 *
 * 用法: node scripts/db/explain-queries.mjs
 *
 * 对项目中关键查询运行 EXPLAIN QUERY PLAN，找出全表扫描和缺失索引。
 * 学习要点：
 *   - SCAN TABLE = 全表扫描（慢）
 *   - SEARCH TABLE ... USING INDEX = 使用索引（快）
 *   - USING COVERING INDEX = 覆盖索引，最快（不需要回表）
 */

import { createClient } from "@libsql/client";

const client = createClient({ url: "file:data/second-brain.db" });

/** 运行 EXPLAIN QUERY PLAN 并格式化输出 */
async function explain(label, sql) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`📊 ${label}`);
  console.log(`${"─".repeat(70)}`);
  console.log(`SQL: ${sql}`);
  console.log(`${"─".repeat(70)}`);

  try {
    const result = await client.execute(`EXPLAIN QUERY PLAN ${sql}`);
    for (const row of result.rows) {
      const detail = row.detail ?? row[3];
      const indent = "  ".repeat(Number(row.id ?? row[0]) || 0);
      // 标注全表扫描
      const flag = String(detail).includes("SCAN TABLE") ? " ⚠️  全表扫描!" : "";
      console.log(`  ${indent}${detail}${flag}`);
    }
  } catch (err) {
    console.log(`  ❌ 错误: ${err.message}`);
  }
}

async function main() {
  console.log("🔍 EXPLAIN QUERY PLAN 分析报告");
  console.log(`时间: ${new Date().toISOString()}`);

  // ── 1. Dashboard: 今日待办查询 ──
  // WHERE userId + dueDate 范围 + status，只有 user_idx
  await explain(
    "Dashboard 今日待办 (todos: userId + dueDate + status)",
    `SELECT id, title, priority, status, due_date
     FROM todos
     WHERE due_date >= 1700000000
       AND due_date < 1700086400
       AND (status = 'todo' OR status = 'in_progress')
       AND user_id = 'test-user'
     ORDER BY due_date ASC, updated_at DESC
     LIMIT 5`
  );

  // ── 2. Dashboard: 搜索书签 ──
  // 多个 LIKE 查全文
  await explain(
    "Dashboard 搜索书签 (bookmarks: 4个 LIKE 全文搜索)",
    `SELECT id, title, url
     FROM bookmarks
     WHERE user_id = 'test-user'
       AND (title LIKE '%test%'
         OR url LIKE '%test%'
         OR summary LIKE '%test%'
         OR content LIKE '%test%')
     LIMIT 5`
  );

  // ── 3. Portfolio: 按 symbol 查持仓 ──
  // userId + symbol，只有 user_idx
  await explain(
    "Portfolio 按 symbol 查持仓 (portfolioHoldings: userId + symbol)",
    `SELECT name, asset_type
     FROM portfolio_holdings
     WHERE user_id = 'test-user'
       AND symbol = 'AAPL'
     LIMIT 1`
  );

  // ── 4. Portfolio: 按 symbol 查新闻 ──
  await explain(
    "Portfolio 按 symbol 查新闻 (portfolioNews: userId + symbol)",
    `SELECT *
     FROM portfolio_news
     WHERE user_id = 'test-user'
       AND symbol = 'AAPL'
     LIMIT 1`
  );

  // ── 5. Focus: 查 pending 的活动会话 ──
  // ingestionStatus 没有索引
  await explain(
    "Focus 查 pending 会话 (activitySessions: ingestionStatus)",
    `SELECT *
     FROM activity_sessions
     WHERE user_id = 'test-user'
       AND started_at < 1700086400
       AND ended_at > 1700000000
       AND (ingestion_status = 'pending' OR ai_summary IS NULL)`
  );

  // ── 6. OSS Projects: collectProjectMeta（N+1 的单次查询）──
  await explain(
    "OSS collectProjectMeta (osProjectNotes: 按 projectId 查 tags)",
    `SELECT tags
     FROM os_project_notes
     WHERE project_id = 'test-project-id'`
  );

  // ── 7. Dashboard: notes 按 userId 排序 ──
  // 有 user_idx，应该命中
  await explain(
    "Dashboard 最近笔记 (notes: userId + ORDER BY updatedAt)",
    `SELECT id, title, updated_at
     FROM notes
     WHERE user_id = 'test-user'
     ORDER BY updated_at DESC
     LIMIT 5`
  );

  // ── 8. Dashboard: pendingTodos ──
  await explain(
    "Dashboard 待办列表 (todos: userId + status)",
    `SELECT id, title, priority
     FROM todos
     WHERE status = 'todo'
       AND user_id = 'test-user'
     ORDER BY created_at DESC
     LIMIT 5`
  );

  // ── 9. Notes: folder 笔记 ──
  await explain(
    "Dashboard folder 笔记 (notes: userId + folder IS NOT NULL)",
    `SELECT id, title, folder, updated_at
     FROM notes
     WHERE user_id = 'test-user'
       AND folder IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 5`
  );

  // ── 10. Learning Notebook: listNotes with search ──
  await explain(
    "Learning listNotes 搜索 (learningNotes: topicId + userId + LIKE)",
    `SELECT *
     FROM learning_notes
     WHERE topic_id = 'test-topic'
       AND user_id = 'test-user'
       AND plain_text LIKE '%keyword%'
     ORDER BY updated_at DESC
     LIMIT 31`
  );

  // ── 汇总 ──
  console.log(`\n${"═".repeat(70)}`);
  console.log("📋 分析要点：");
  console.log("  - SCAN TABLE = 全表扫描，数据量大时会很慢");
  console.log("  - SEARCH ... USING INDEX = 使用了索引");
  console.log("  - USING COVERING INDEX = 覆盖索引（最优，不回表）");
  console.log("  - 关注 ⚠️ 标记的查询，这些是优化候选");
  console.log(`${"═".repeat(70)}\n`);

  client.close();
}

main().catch(console.error);
