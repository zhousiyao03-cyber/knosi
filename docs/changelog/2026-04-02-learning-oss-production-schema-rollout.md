# 2026-04-02 Learning / OSS Production Schema Rollout

## Date

2026-04-02

## Task / Goal

修复线上 `ossProjects.listProjects` 返回 500 的问题。

## Root Cause

线上 Turso 数据库没有同步到 `learning_topics` / `learning_notes` / `learning_reviews` / `os_projects` / `os_project_notes` 这 5 张新表。代码已经部署，但生产 schema 没补齐，导致：

- `ossProjects.listProjects` 查询 `os_projects` 时直接抛错
- 同类的 Learning Notebook 相关查询也存在同样风险

## Key Changes

- 使用 `.env.turso-prod.local` 连接生产 Turso
- 先查询 `sqlite_master`，确认上述 5 张表在线上全部缺失
- 对生产库执行最小化 `CREATE TABLE IF NOT EXISTS ...`，只补 Learning / OSS 模块相关表
- 再次验证 `sqlite_master`
- 直接执行与报错同形态的 `select ... from os_projects where user_id = ? order by updated_at desc`，确认查询已恢复

## Files Touched

- `docs/changelog/2026-04-02-learning-oss-production-schema-rollout.md`

## Verification Commands And Results

- 生产表检查：
  - `set -a && source .env.turso-prod.local && set +a && node - <<'EOF' ... select name, type from sqlite_master where name in (...) ... EOF`
  - 结果：`[]`，确认线上缺表
- 生产 schema rollout：
  - `set -a && source .env.turso-prod.local && set +a && node - <<'EOF' ... CREATE TABLE IF NOT EXISTS ... EOF`
  - 结果：成功创建 `learning_topics`、`learning_notes`、`learning_reviews`、`os_projects`、`os_project_notes`
- 生产查询回归验证：
  - `set -a && source .env.turso-prod.local && set +a && node - <<'EOF' ... select ... from os_projects where user_id = ? ... EOF`
  - 结果：成功返回 `{ "rows": 0 }`，说明查询路径已恢复，不再是 schema 缺失导致的 500

## Remaining Risks / Follow-up

- 这次仍然是手工生产 schema rollout，不是稳定的自动 migration 流程
- 后续新增表时，最好补一条明确的生产 migration/runbook，避免再次出现“代码已部署但 Turso 未同步”的事故
