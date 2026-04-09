# 2026-04-09 — Database backup system

## Goal

建立每日自动备份生产 Turso 数据库的机制，支持灾难恢复 + 单笔记回滚。

## Key changes

- 新建独立私有仓库 `zhousiyao03-cyber/second-brain-backup` 存放备份产物
- GitHub Actions scheduled workflow：UTC 20:00 / 北京 04:00 每天触发
- 备份产物：
  - `backup.sql` — Turso CLI `.dump` 全量（BLOB-safe）
  - `notes/`、`learning_notes/`、`os_project_notes/`、`bookmarks/` — 按行拆分 JSON
  - `assets/<sha256>.<ext>` — 从 Tiptap base64 图片抽离的去重二进制
  - `manifest.json` — 每次运行摘要
- 不占用 `vercel.json` 的 cron 名额（走 GitHub Actions）
- 凭证存在 backup repo 的 GitHub Actions secrets 里（`TURSO_DATABASE_URL` /
  `TURSO_AUTH_TOKEN`），source of truth 还是本地的
  `.env.turso-prod.local`

## Files touched

**主 repo（second-brain）：**
- `docs/specs/2026-04-09-database-backup-design.md` (new)
- `docs/plans/2026-04-09-database-backup.md` (new)
- `docs/changelog/2026-04-09-database-backup-system.md` (this file)
- 无代码改动

**新 repo（second-brain-backup）：**
- `.github/workflows/backup.yml`
- `scripts/dump-sql.mjs` — libsql-based SQL dump 入口
- `scripts/lib/dump-sql.mjs` — dump 核心（可测试）
- `scripts/lib/dump-sql.test.mjs` — 19 个单测
- `scripts/split-notes.mjs` — 按笔记拆分 + 图片抽离
- `scripts/lib/extract-assets.mjs` — 资源抽取核心
- `scripts/lib/extract-assets.test.mjs` — 7 个单测
- `package.json`
- `.gitignore`
- `README.md`

**关键技术决策变更：**
- 原 design 计划用 Turso CLI `.dump` 生成备份 SQL
- CI 实测失败：`turso db shell` 只认已登录的平台 session，不接受
  `TURSO_AUTH_TOKEN` 环境变量，无法 headless 使用
- 改用 `@libsql/client` 手写 dump 逻辑，正确处理 BLOB (X'<hex>'
  字面量) 和单引号转义
- 本地用 `sqlite3 3.51.0` 回放 9.4 MB 生产 dump 成功（无 error、
  schema 与 index 完整、table counts 与 libsql 原生查询一致）

## Verification

- `node --test scripts/lib/*.test.mjs` — 26 tests passing（7 extract-assets + 19 dump-sql）
- split-notes 本地烟测：`OUTPUT_DIR=/tmp/backup-smoketest node scripts/split-notes.mjs`
  - `stats: { notes: 18, learning_notes: 9, os_project_notes: 30, bookmarks: 0 }`
  - `assetCount: 4`
  - 抽样 note JSON 中 `data:image/` 出现 0 次（已替换为 `asset://<hash>.png`）
  - 4 个 asset 文件 magic bytes `89 50 4E 47` 确认是真实 PNG
- dump-sql 本地烟测：`OUTPUT_FILE=/tmp/backup-smoke.sql node scripts/dump-sql.mjs`
  - 产出 9,388,277 字节 (~9.4 MB)
  - `sqlite3 /tmp/restore.db < /tmp/backup-smoke.sql` 无 error，10.3 MB DB 文件
  - restore 后 schema + index 完整，notes/learning_notes/os_project_notes 行数一致
- GitHub Actions 手动触发：
  - 第 1 次失败 — Turso CLI 无 headless auth
  - 第 2 次失败 — `@libsql/client` 的 macOS 生成 lockfile 在 Linux runner
    上导致 optional deps 半装，解析失败
  - 第 3 次成功 — workflow 改为 `rm -f package-lock.json && npm install`
    （lockfile 已从 repo 移除并加入 .gitignore）
  - CI bot commit: `f2b9a9f backup: 2026-04-09`
  - 产出 `backup.sql` = 9,395,798 bytes
  - manifest: notes=18 / learning_notes=9 / os_project_notes=30 /
    bookmarks=0 / assetCount=4
- Throwaway 恢复演练：
  - `sqlite3 /tmp/restore.db < backup.sql` → 0 error, 10.3 MB DB
  - 交叉验证 counts 完全一致（含 activity_sessions=6488, knowledge_chunks=50）
  - Schema + index 完整

## Remaining risks / follow-ups

- GitHub Secrets 必须由用户手动配置一次，AI 无法代劳
- Token 过期时需要手动轮换（workflow 会红，GitHub 默认发邮件）
- base64 图片抽离后的 git pack 增长需要持续观察，10 年尺度应无压力
- 如果未来加了新的"包含用户内容 + Tiptap JSON"的表，需要手动更新
  `scripts/split-notes.mjs` 里的 `TABLES` 数组
- 首次 Actions 手动 run 之后需要完成：
  1. Task 6 的 throwaway 恢复演练
  2. Task 9 的 pre-merge gate 报告
  3. Task 10 的 post-merge self-test 报告（包含次日 scheduled run 验证）
