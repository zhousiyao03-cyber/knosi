# Design — Second Brain Database Backup

Date: 2026-04-09
Status: Approved in brainstorming, pending written-spec review

## 1. 问题与动机

Second Brain 的所有用户数据（笔记、书签、学习笔记、OSS 项目笔记、
focus 记录、portfolio、AI 聊天等）目前只存在一份生产 Turso 数据库里。
一旦发生以下任一场景，所有数据会永久丢失：

1. Turso 服务事故 / 账号异常
2. 用户误操作（误删笔记、误跑 migration、rollout 写坏数据）
3. 代码 bug 污染数据（比如编辑器扩展改动把 Tiptap JSON 写坏）

现有机制完全没有任何备份，风险敞口太大。

## 2. 目标与非目标

### 目标

- **每天**自动、无人值守地把生产 Turso 完整备份到异地
- 支持两种恢复场景：
  - **灾难恢复**：整库重建（换一个新 Turso 库）
  - **细粒度回滚**：恢复某一篇笔记到 N 天前的状态
- 备份必须包含所有用户内容，**包括内嵌在 Tiptap JSON 里的 base64 图片**
- 正确处理 `knowledge_chunk_embeddings.vector` 的 **BLOB** 列
- 零成本（GitHub Actions 免费额度 + Turso 免费额度内）
- 不占用 `vercel.json` 的 cron 名额（Hobby plan 只允许 1 个）

### 非目标

- 实时 / 增量备份（每日粒度已足够，RPO = 24h 可接受）
- 多副本 / 多区域（单一 GitHub 私有仓库足够）
- UI / 管理面板（纯后台任务，不需要可视化）
- 自动恢复脚本（恢复是低频 + 需要人类判断的操作，写文档即可）
- 备份生产 Turso 之外的数据（本地 `data/*.db` 不备份）

## 3. 方案概述

**架构**：

```
每天 UTC 20:00 (北京 04:00)
        │
        ▼
GitHub Actions (secondary repo: second-brain-backup)
        │
        ├── 1. npm install (@libsql/client)
        ├── 2. node scripts/dump-sql.mjs → backup.sql
        │      (libsql client 手写 dump, 支持 BLOB)
        ├── 3. node scripts/split-notes.mjs
        │      (连生产 Turso, 拆分笔记 + 抽离 base64 图片)
        ├── 4. git add -A && git commit && git push
        ▼
second-brain-backup repo (private, GitHub)
  ├── backup.sql               # 完整 SQL dump (灾难恢复)
  ├── notes/<id>.json          # 按笔记拆分 (细粒度回滚)
  ├── learning_notes/<id>.json
  ├── os_project_notes/<id>.json
  ├── bookmarks/<id>.json
  └── assets/<sha256>.<ext>    # 去重后的图片资源
```

### 两份产物的分工

**产物 A — `backup.sql`（完整 SQL dump）**

- ~~用 Turso CLI 的 `.dump` 命令生成~~ **CI 实测 Turso CLI 无法 headless 认证**
  （只认 `turso auth login` 的平台 session，`TURSO_AUTH_TOKEN` env var 不被
  `db shell` 接受），因此改用 `scripts/dump-sql.mjs` 走 `@libsql/client`
  直接连库手写一份 SQLite 兼容的 dump
- BLOB 列以 `X'<hex>'` 字面量输出（SQLite 原生 blob literal，`.dump` 也用这个）
- 字符串单引号转义为 `''`，NULL 输出 `NULL`
- 可以用 `sqlite3 <file.db> < backup.sql` 或 `turso db shell <new-db> < backup.sql`
  恢复到任何新库；本地已用 `sqlite3 3.51.0` 验证过 9.4 MB 生产 dump 能无错回放
- 这是**灾难恢复的唯一可靠路径**
- 每天覆盖一次（git 自己保留历史）

**产物 B — 按笔记拆分的 JSON + 去重图片资源**

- Node 脚本遍历 `notes` / `learning_notes` / `os_project_notes` /
  `bookmarks` 四张表
- 每条记录写一个 `<table>/<id>.json` 文件，包含 title / content /
  plainText / tags / 时间戳等
- **关键优化**：遍历 Tiptap JSON，把所有 `data:image/...;base64,...`
  替换为 `asset://<sha256>.<ext>` 引用，实际二进制写到 `assets/` 下
- 这样未改动的图片 = 0 diff，git 历史极其干净
- 用途：日常回滚、跨系统迁移、人类可读审计

## 4. 触发与调度

- **不用 Vercel cron**（Hobby plan 已被 `portfolio-news` 占满）
- **用 GitHub Actions scheduled workflow**
- 时间：`cron: "0 20 * * *"`（UTC 20:00 = 北京 04:00，避开写作时段）
- 手动触发：保留 `workflow_dispatch` 入口方便 debug

## 5. 凭证管理

- 新建私有仓库 `second-brain-backup` 下配置 GitHub Actions Secrets：
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
- 本地 `.env.turso-prod.local` 是这两个值的唯一 source of truth
- 用户手动一次性把值粘到 GitHub Secrets（AI 不接触明文）
- workflow 里通过 `${{ secrets.TURSO_DATABASE_URL }}` 注入

## 6. 脚本设计 — `split-notes.mjs`

```
输入: 环境变量 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN, 目标目录 ./output
输出: notes/, learning_notes/, os_project_notes/, bookmarks/, assets/

伪代码:
  client = createClient({ url, authToken })  // @libsql/client
  for table in [notes, learning_notes, os_project_notes, bookmarks]:
    rows = await client.execute(`SELECT * FROM ${table}`)
    mkdir output/${table}
    for row in rows:
      cleaned = extractAssets(row.content)
        // 遍历 Tiptap JSON, 对每个 data:image/...;base64,... :
        //   buf = base64 decode
        //   hash = sha256(buf)
        //   ext = 从 mime 推断 (png/jpg/gif/webp/svg)
        //   写入 assets/<hash>.<ext> (如果不存在)
        //   把节点的 src 替换成 "asset://<hash>.<ext>"
      write JSON to output/${table}/${row.id}.json
  write manifest.json (表统计, 总资源数, 运行时间戳)
```

**依赖**：`@libsql/client`（repo 里已经在用）
**执行环境**：GitHub Actions 自带的 Node 20+
**资源抽取策略**：
- 只处理 `notes.content` / `learning_notes.content` /
  `os_project_notes.content` / `bookmarks.content` 字段
- Tiptap JSON 是 tree, 递归遍历所有节点的 `attrs.src`
- 非 `data:image/` 开头的 src 原样保留（比如 Excalidraw 的
  `data:image/svg+xml;base64,` 也同样处理，因为是同一格式）
- 不修改 `plain_text` 字段

## 7. GitHub Actions Workflow 结构

```yaml
name: backup
on:
  schedule: [{ cron: "0 20 * * *" }]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Install Turso CLI
        run: curl -sSfL https://get.tur.so/install.sh | bash
      - name: Dump SQL
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
        run: turso db shell "$TURSO_DATABASE_URL" ".dump" > backup.sql
      - name: Split notes + extract assets
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
        run: |
          npm install @libsql/client
          node scripts/split-notes.mjs
      - name: Commit & push
        run: |
          git config user.name "backup-bot"
          git config user.email "backup@noreply.local"
          git add -A
          git diff --cached --quiet || git commit -m "backup: $(date -u +%F)"
          git push
```

## 8. 仓库结构（second-brain-backup）

```
second-brain-backup/
├── .github/workflows/backup.yml
├── scripts/split-notes.mjs
├── README.md                  # 恢复说明
├── backup.sql                 # 每天覆盖
├── manifest.json              # 最近一次运行摘要
├── notes/<id>.json
├── learning_notes/<id>.json
├── os_project_notes/<id>.json
├── bookmarks/<id>.json
└── assets/<sha256>.<ext>
```

## 9. 恢复流程（写进 backup repo 的 README）

**灾难恢复（整库）**：
1. 新建一个 Turso 库
2. `turso db shell <new-db> < backup.sql`
3. 更新 `.env.turso-prod.local` 指向新库
4. 验证 `SELECT COUNT(*) FROM notes;` 数量合理

**单笔记回滚**（人工操作，不提供自动脚本）：
1. `cd second-brain-backup && git log -- notes/<id>.json` 找目标版本
2. `git show <sha>:notes/<id>.json > restored.json`
3. 如果引用了 `asset://<hash>.ext`，同样 checkout 对应 commit 的 assets
4. 手动把 `asset://` 引用替换回 `data:image/...;base64,...`
   （编码回 base64 后拼接 mime 前缀）
5. 把结果里的 `content` 字段粘回 app 的编辑器，或直接 UPDATE 数据库

## 10. 失败处理

- **workflow 失败**：GitHub Actions 默认发邮件到仓库所有者，用户会收到
- **部分失败**（SQL dump 成功但 split 失败）：仍然 commit `backup.sql`，
  保证灾难恢复不受影响；failure 记录进 `manifest.json`
- **commit 为空**（连续两天完全没变化，理论上几乎不可能）：
  `git diff --cached --quiet || commit` 跳过空 commit
- **Turso auth token 过期**：workflow 会红，用户收邮件，手动轮换

## 11. 风险与权衡

| 风险 | 缓解 |
|---|---|
| backup.sql 每天都是全量 → repo 膨胀 | 覆盖同一文件，靠 git pack 压缩去冗余 |
| base64 图片 diff 不友好 | 抽离到 assets/<hash> 去重，根本上解决 |
| Turso 免费额度 | 全量 dump 约几千到几万行，一年 < 1% 额度 |
| GitHub Actions 额度 | 私有 repo 2000 分钟/月，每次 1-2 分钟，用掉 ~3% |
| token 泄漏 | 只放 GitHub Secrets，不提交到任何 repo |
| workflow 静默失败 | GitHub 默认 failure 邮件告警 |

## 12. 验证

### 12.1 Self-Verification Strategy

- 在 `second-brain-backup` repo 里手动 trigger 一次 workflow
  （`workflow_dispatch`）
- 检查 repo 里出现了 `backup.sql` + `notes/*.json` + `assets/*`
- 随便打开一个 `notes/<id>.json`，确认：
  - title 和你熟悉的笔记对得上
  - content 里没有 `data:image/` 开头的 base64（都被替换成了
    `asset://<hash>.ext`）
- 检查 `assets/` 下的文件能正常用图片查看器打开
- 检查 `backup.sql` 头部是 `PRAGMA foreign_keys=OFF;` + `BEGIN TRANSACTION;`
- 本地拉下 backup.sql，用 `turso db create` 创建一个 throwaway 库，
  `turso db shell <throwaway> < backup.sql`，跑
  `SELECT COUNT(*) FROM notes;` 对比生产的数量，确认一致

### 12.2 Acceptance Criteria

- [ ] `second-brain-backup` 私有 repo 已创建
- [ ] Secrets `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` 已配置
- [ ] Workflow 手动 trigger 成功跑完 (绿)
- [ ] repo 里存在 `backup.sql` 且 > 0 字节
- [ ] 四张表至少各有一个 `<id>.json` 文件
- [ ] 至少有一个 `assets/<hash>.ext` 文件，且能打开
- [ ] 随机挑一篇笔记做恢复演练（上面的 throwaway 验证）
- [ ] 下一天的 scheduled run 自动触发成功（04:01 后查 Actions 页）
- [ ] README 里恢复步骤清晰，无歧义

## 13. 开放问题

**无**。所有关键决策已在 brainstorming 阶段确认：
- Repo: `second-brain-backup` (private, 个人账号)
- 时间: UTC 20:00 / 北京 04:00
- 双产物: SQL dump + JSON 拆分 + 图片资源去重
- 触发: GitHub Actions (不占 Vercel cron)
- 凭证: 用户手动配 GitHub Secrets
