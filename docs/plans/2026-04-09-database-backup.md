# Database Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每天自动把生产 Turso 数据库备份到一个独立的私有 GitHub 仓库，产出 SQL dump + 按笔记拆分的 JSON + 去重图片资源，支持灾难恢复与细粒度回滚。

**Architecture:** 新建私有仓库 `second-brain-backup`，包含一个 GitHub Actions workflow（每天 UTC 20:00 触发）和一个 Node 脚本。Workflow 用 Turso CLI `.dump` 生成完整 SQL，再用 `@libsql/client` 读笔记表、拆分 JSON 并把 base64 图片抽离到 `assets/<sha256>.<ext>`。所有产物 commit 回同一 repo，依赖 git 历史做版本管理。

**Tech Stack:** GitHub Actions、Turso CLI、Node 20、`@libsql/client`、Node built-in `crypto` / `fs`

**Design doc:** `docs/specs/2026-04-09-database-backup-design.md`

---

## File Structure

**second-brain 主 repo（本 repo）— 只改一个文档**
- Modify: `docs/changelog/` — 新增一个 changelog 记录这次备份系统搭建

**second-brain-backup 新 repo — 所有主产物**
- Create: `.github/workflows/backup.yml` — 调度 + workflow 步骤
- Create: `scripts/split-notes.mjs` — 笔记拆分 + 图片抽离
- Create: `scripts/lib/extract-assets.mjs` — 可单独测试的资源抽取函数
- Create: `scripts/lib/extract-assets.test.mjs` — 单测（用 node --test）
- Create: `package.json` — 声明 `@libsql/client` 依赖
- Create: `.gitignore` — 排除 node_modules
- Create: `README.md` — 恢复流程说明
- Create: `backup.sql`（运行时生成）
- Create: `notes/` / `learning_notes/` / `os_project_notes/` / `bookmarks/`（运行时生成）
- Create: `assets/`（运行时生成）
- Create: `manifest.json`（运行时生成）

---

## Task 1: 创建并初始化 second-brain-backup repo

**Files:**
- Create: 新 GitHub 私有仓库 `second-brain-backup`
- Create: 本地工作目录 `~/second-brain-backup/`

- [ ] **Step 1: 在 GitHub 网页创建私有仓库**

  用户操作（AI 无法代劳）：
  1. 打开 https://github.com/new
  2. Owner: `zhousiyao03-cyber`
  3. Repository name: `second-brain-backup`
  4. Visibility: **Private**
  5. 不要勾选 "Add a README"、"Add .gitignore"、"Add license"（我们自己加）
  6. Create repository

- [ ] **Step 2: 本地 clone 到兄弟目录**

  ```bash
  cd ~ && git clone git@github.com:zhousiyao03-cyber/second-brain-backup.git
  cd second-brain-backup
  ```

  Expected: 一个空目录（除了 `.git/`）

- [ ] **Step 3: 配置 GitHub Actions Secrets**

  用户操作（AI 无法代劳）：
  1. 打开 `https://github.com/zhousiyao03-cyber/second-brain-backup/settings/secrets/actions`
  2. New repository secret → Name: `TURSO_DATABASE_URL` → Value: 从 `/Users/bytedance/second-brain/.env.turso-prod.local` 复制 `TURSO_DATABASE_URL` 的值
  3. New repository secret → Name: `TURSO_AUTH_TOKEN` → Value: 从同一文件复制 `TURSO_AUTH_TOKEN` 的值
  4. 确认两个 secrets 都出现在列表里

  **安全提醒：绝对不要把这两个值 paste 到任何 commit / issue / PR 评论**

- [ ] **Step 4: 提交空的 .gitignore + README 占位**

  创建 `.gitignore`：
  ```
  node_modules/
  .DS_Store
  *.log
  ```

  创建 `README.md`（占位，后面 Task 7 完善）：
  ```markdown
  # second-brain-backup

  Automated daily backup of Second Brain production Turso database.
  See `docs/specs/2026-04-09-database-backup-design.md` in the main repo.
  ```

  ```bash
  git add .gitignore README.md
  git commit -m "chore: initial commit"
  git push -u origin main
  ```

  Expected: push 成功，GitHub 上能看到两个文件

---

## Task 2: 写资源抽取函数 + 单测（TDD）

**Files:**
- Create: `~/second-brain-backup/scripts/lib/extract-assets.mjs`
- Create: `~/second-brain-backup/scripts/lib/extract-assets.test.mjs`
- Create: `~/second-brain-backup/package.json`

- [ ] **Step 1: 初始化 package.json**

  ```bash
  cd ~/second-brain-backup
  cat > package.json <<'EOF'
  {
    "name": "second-brain-backup",
    "version": "1.0.0",
    "private": true,
    "type": "module",
    "scripts": {
      "test": "node --test scripts/lib/*.test.mjs",
      "backup": "node scripts/split-notes.mjs"
    },
    "dependencies": {
      "@libsql/client": "^0.15.0"
    }
  }
  EOF
  ```

- [ ] **Step 2: 写失败的测试**

  创建 `scripts/lib/extract-assets.test.mjs`：

  ```javascript
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { extractAssets } from "./extract-assets.mjs";

  // 1x1 红色 PNG 的 base64
  const RED_PNG_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Zy5z3sAAAAASUVORK5CYII=";

  test("returns unchanged when no images present", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
    const assets = new Map();
    const cleaned = extractAssets(doc, assets);
    assert.deepEqual(cleaned, doc);
    assert.equal(assets.size, 0);
  });

  test("extracts a base64 image node and replaces src with asset:// ref", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: `data:image/png;base64,${RED_PNG_B64}`, alt: "red" },
        },
      ],
    };
    const assets = new Map();
    const cleaned = extractAssets(doc, assets);

    assert.equal(assets.size, 1);
    const [key, value] = [...assets.entries()][0];
    assert.match(key, /^[a-f0-9]{64}\.png$/);
    assert.ok(Buffer.isBuffer(value));

    assert.equal(cleaned.content[0].attrs.src, `asset://${key}`);
    assert.equal(cleaned.content[0].attrs.alt, "red");
  });

  test("deduplicates identical images across nodes", () => {
    const src = `data:image/png;base64,${RED_PNG_B64}`;
    const doc = {
      type: "doc",
      content: [
        { type: "image", attrs: { src } },
        { type: "image", attrs: { src } },
      ],
    };
    const assets = new Map();
    extractAssets(doc, assets);
    assert.equal(assets.size, 1);
  });

  test("handles null / undefined / string content gracefully", () => {
    assert.equal(extractAssets(null, new Map()), null);
    assert.equal(extractAssets(undefined, new Map()), undefined);
    const assets = new Map();
    const result = extractAssets("raw string content", assets);
    assert.equal(result, "raw string content");
    assert.equal(assets.size, 0);
  });

  test("accepts JSON string input (auto-parses)", () => {
    const src = `data:image/png;base64,${RED_PNG_B64}`;
    const json = JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src } }] });
    const assets = new Map();
    const cleaned = extractAssets(json, assets);
    assert.equal(typeof cleaned, "object");
    assert.equal(assets.size, 1);
    assert.match(cleaned.content[0].attrs.src, /^asset:\/\//);
  });

  test("infers extension from mime type", () => {
    const mimeToExt = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };
    for (const [mime, ext] of Object.entries(mimeToExt)) {
      const assets = new Map();
      extractAssets(
        { type: "image", attrs: { src: `data:${mime};base64,${RED_PNG_B64}` } },
        assets,
      );
      const key = [...assets.keys()][0];
      assert.ok(key.endsWith(`.${ext}`), `expected ${ext} for ${mime}, got ${key}`);
    }
  });

  test("non-data-url src is left untouched", () => {
    const doc = { type: "image", attrs: { src: "https://example.com/a.png" } };
    const assets = new Map();
    const cleaned = extractAssets(doc, assets);
    assert.equal(cleaned.attrs.src, "https://example.com/a.png");
    assert.equal(assets.size, 0);
  });
  ```

- [ ] **Step 3: 运行测试确认全部失败**

  ```bash
  cd ~/second-brain-backup
  node --test scripts/lib/extract-assets.test.mjs
  ```

  Expected: FAIL — `Cannot find module './extract-assets.mjs'`

- [ ] **Step 4: 写最小实现**

  创建 `scripts/lib/extract-assets.mjs`：

  ```javascript
  import { createHash } from "node:crypto";

  const MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };

  const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

  /**
   * 递归遍历 Tiptap JSON，把所有 data:image/... base64 src 抽离到 assets map，
   * 节点上的 src 替换为 asset://<sha256>.<ext> 引用。
   *
   * @param {unknown} node         Tiptap JSON 节点、JSON 字符串、或任意值
   * @param {Map<string, Buffer>} assets  累积的资源表：filename -> Buffer
   * @returns {unknown}            清洗后的节点（原地克隆，不修改输入）
   */
  export function extractAssets(node, assets) {
    if (node == null) return node;

    // 字符串可能是 JSON 序列化的 Tiptap doc，尝试解析
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(node);
          return extractAssets(parsed, assets);
        } catch {
          return node;
        }
      }
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((child) => extractAssets(child, assets));
    }

    if (typeof node !== "object") return node;

    const cloned = { ...node };

    // 处理 attrs.src
    if (cloned.attrs && typeof cloned.attrs === "object") {
      const src = cloned.attrs.src;
      if (typeof src === "string") {
        const match = src.match(DATA_URL_RE);
        if (match) {
          const [, mime, b64] = match;
          const buf = Buffer.from(b64, "base64");
          const hash = createHash("sha256").update(buf).digest("hex");
          const ext = MIME_EXT[mime.toLowerCase()] ?? "bin";
          const filename = `${hash}.${ext}`;
          if (!assets.has(filename)) {
            assets.set(filename, buf);
          }
          cloned.attrs = { ...cloned.attrs, src: `asset://${filename}` };
        }
      }
    }

    // 递归处理 content 数组
    if (Array.isArray(cloned.content)) {
      cloned.content = cloned.content.map((child) => extractAssets(child, assets));
    }

    return cloned;
  }
  ```

- [ ] **Step 5: 运行测试确认全部通过**

  ```bash
  node --test scripts/lib/extract-assets.test.mjs
  ```

  Expected: PASS — 7 tests passing

- [ ] **Step 6: Commit**

  ```bash
  git add package.json scripts/lib/extract-assets.mjs scripts/lib/extract-assets.test.mjs
  git commit -m "feat: add asset extraction with deduplication + tests"
  ```

---

## Task 3: 写 split-notes.mjs 主脚本

**Files:**
- Create: `~/second-brain-backup/scripts/split-notes.mjs`

- [ ] **Step 1: 写脚本**

  创建 `scripts/split-notes.mjs`：

  ```javascript
  #!/usr/bin/env node
  /**
   * 备份脚本入口。
   * 输入（环境变量）：
   *   TURSO_DATABASE_URL
   *   TURSO_AUTH_TOKEN
   *   OUTPUT_DIR (可选，默认当前目录)
   *
   * 输出：
   *   <output>/notes/<id>.json
   *   <output>/learning_notes/<id>.json
   *   <output>/os_project_notes/<id>.json
   *   <output>/bookmarks/<id>.json
   *   <output>/assets/<sha256>.<ext>
   *   <output>/manifest.json
   */
  import { createClient } from "@libsql/client";
  import { mkdir, writeFile, rm } from "node:fs/promises";
  import { join } from "node:path";
  import { extractAssets } from "./lib/extract-assets.mjs";

  const TABLES = ["notes", "learning_notes", "os_project_notes", "bookmarks"];

  async function main() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
      process.exit(1);
    }

    const outputDir = process.env.OUTPUT_DIR ?? process.cwd();
    const startedAt = new Date().toISOString();
    const client = createClient({ url, authToken });

    // 清空旧的拆分目录（保证删除的笔记不会残留）
    for (const table of TABLES) {
      await rm(join(outputDir, table), { recursive: true, force: true });
    }
    await rm(join(outputDir, "assets"), { recursive: true, force: true });

    const assets = new Map(); // filename -> Buffer
    const stats = {};

    for (const table of TABLES) {
      const dir = join(outputDir, table);
      await mkdir(dir, { recursive: true });

      const result = await client.execute(`SELECT * FROM ${table}`);
      stats[table] = result.rows.length;

      for (const row of result.rows) {
        const record = {};
        for (const col of result.columns) {
          record[col] = row[col];
        }

        // 清洗 content 字段里的 base64 图片
        if (record.content != null) {
          record.content = extractAssets(record.content, assets);
        }

        const id = record.id;
        if (!id || typeof id !== "string") {
          console.warn(`skipping row without id in ${table}`);
          continue;
        }
        // 防御：id 里不应出现 / 或 ..，但 sanitize 一下保险
        const safeId = id.replace(/[^a-zA-Z0-9_\-]/g, "_");
        await writeFile(
          join(dir, `${safeId}.json`),
          JSON.stringify(record, null, 2),
          "utf8",
        );
      }
    }

    // 写资源文件
    const assetsDir = join(outputDir, "assets");
    await mkdir(assetsDir, { recursive: true });
    for (const [filename, buf] of assets) {
      await writeFile(join(assetsDir, filename), buf);
    }

    const finishedAt = new Date().toISOString();
    const manifest = {
      startedAt,
      finishedAt,
      stats,
      assetCount: assets.size,
    };
    await writeFile(
      join(outputDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    console.log("backup split complete:", manifest);
  }

  main().catch((err) => {
    console.error("backup failed:", err);
    process.exit(1);
  });
  ```

- [ ] **Step 2: 本地烟测（dry run）**

  ```bash
  cd ~/second-brain-backup
  npm install
  set -a && source /Users/bytedance/second-brain/.env.turso-prod.local && set +a
  OUTPUT_DIR=/tmp/backup-smoketest node scripts/split-notes.mjs
  ```

  Expected:
  - 控制台输出 `backup split complete: { startedAt, finishedAt, stats: {...}, assetCount: N }`
  - `/tmp/backup-smoketest/notes/` 里至少有一个 .json 文件
  - `/tmp/backup-smoketest/assets/` 里至少有一个图片文件（如果你有笔记带图的话）
  - `/tmp/backup-smoketest/manifest.json` 内容合理

- [ ] **Step 3: 人肉抽查一个 notes JSON**

  ```bash
  ls /tmp/backup-smoketest/notes | head -1 | xargs -I{} cat /tmp/backup-smoketest/notes/{} | head -40
  ```

  人工确认：
  - 有 title / content / createdAt 等字段
  - `content` 字段里不应出现 `data:image/` 开头的字符串（都被替换了）
  - 如果有图片，应该看到 `"src": "asset://<hash>.png"`

- [ ] **Step 4: 抽查一个 asset 文件能打开**

  ```bash
  ls /tmp/backup-smoketest/assets | head -1
  open /tmp/backup-smoketest/assets/<first-file>
  ```

  Expected: 预览正常显示图片

- [ ] **Step 5: 清理烟测目录**

  ```bash
  rm -rf /tmp/backup-smoketest
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add scripts/split-notes.mjs
  git commit -m "feat: add split-notes script with libsql + asset extraction"
  ```

---

## Task 4: 写 GitHub Actions workflow

**Files:**
- Create: `~/second-brain-backup/.github/workflows/backup.yml`

- [ ] **Step 1: 创建 workflow 文件**

  ```bash
  mkdir -p ~/second-brain-backup/.github/workflows
  ```

  创建 `.github/workflows/backup.yml`：

  ```yaml
  name: backup

  on:
    schedule:
      - cron: "0 20 * * *"  # UTC 20:00 = Asia/Shanghai 04:00
    workflow_dispatch:

  permissions:
    contents: write

  concurrency:
    group: backup
    cancel-in-progress: false

  jobs:
    backup:
      runs-on: ubuntu-latest
      timeout-minutes: 15
      steps:
        - name: Checkout
          uses: actions/checkout@v4

        - name: Setup Node
          uses: actions/setup-node@v4
          with:
            node-version: "20"

        - name: Install Turso CLI
          run: |
            curl -sSfL https://get.tur.so/install.sh | bash
            echo "$HOME/.turso" >> "$GITHUB_PATH"

        - name: Verify Turso CLI
          run: turso --version

        - name: Install npm deps
          run: npm ci || npm install

        - name: Dump SQL
          env:
            TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
            TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
          run: |
            turso db shell "$TURSO_DATABASE_URL" ".dump" > backup.sql
            echo "backup.sql size: $(wc -c < backup.sql) bytes"
            test -s backup.sql

        - name: Split notes + extract assets
          env:
            TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
            TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
          run: node scripts/split-notes.mjs

        - name: Run unit tests
          run: node --test scripts/lib/*.test.mjs

        - name: Commit and push
          run: |
            git config user.name "backup-bot"
            git config user.email "backup@noreply.local"
            git add -A
            if git diff --cached --quiet; then
              echo "No changes to commit."
            else
              git commit -m "backup: $(date -u +%F)"
              git push
            fi
  ```

- [ ] **Step 2: Commit**

  ```bash
  cd ~/second-brain-backup
  git add .github/workflows/backup.yml
  git commit -m "ci: add scheduled backup workflow"
  git push
  ```

  Expected: push 成功，GitHub Actions 页面出现 `backup` workflow

---

## Task 5: 手动触发 workflow 验证端到端

**Files:** (no code changes)

- [ ] **Step 1: 在 GitHub 网页手动触发**

  用户操作：
  1. 打开 `https://github.com/zhousiyao03-cyber/second-brain-backup/actions`
  2. 点左侧 `backup` workflow
  3. 右上角 "Run workflow" → "Run workflow"
  4. 等几分钟直到 run 变成绿勾（失败则看日志 debug）

- [ ] **Step 2: 确认每一步都绿**

  检查 job 里每个 step：
  - Checkout ✓
  - Setup Node ✓
  - Install Turso CLI ✓
  - Verify Turso CLI ✓
  - Install npm deps ✓
  - Dump SQL ✓（日志里应该有 `backup.sql size: N bytes`，N > 0）
  - Split notes + extract assets ✓（日志里应该有 `backup split complete: ...`）
  - Run unit tests ✓
  - Commit and push ✓

- [ ] **Step 3: 检查 repo 产物**

  ```bash
  cd ~/second-brain-backup
  git pull
  ls -la
  ```

  Expected:
  - `backup.sql` 存在且 > 0 字节
  - `manifest.json` 内容合理
  - `notes/`、`learning_notes/`、`os_project_notes/`、`bookmarks/` 四个目录都存在
  - `assets/` 存在（如果有图片）
  - 最新 commit 来自 `backup-bot`

- [ ] **Step 4: 如果失败，根据日志 debug**

  常见问题：
  - `turso: command not found` → 检查 `$GITHUB_PATH` 那一行
  - `auth failed` → 检查 secrets 配置
  - `split-notes.mjs` crash → 可能某张表的 content 格式意外，回本地复现并修
  - 修完后 commit 推 push，再次手动触发

---

## Task 6: Throwaway 恢复演练

**Files:** (no code changes)

- [ ] **Step 1: 创建一个 throwaway Turso 库**

  ```bash
  turso db create backup-restore-test
  ```

  Expected: 输出 `Created database backup-restore-test`

- [ ] **Step 2: 把 backup.sql 灌进去**

  ```bash
  cd ~/second-brain-backup
  turso db shell backup-restore-test < backup.sql
  ```

  Expected: 无报错。允许一些 "already exists" 类警告（`.dump` 会包含 CREATE TABLE）

- [ ] **Step 3: 对比行数**

  记录生产库的笔记数：
  ```bash
  set -a && source /Users/bytedance/second-brain/.env.turso-prod.local && set +a
  turso db shell "$TURSO_DATABASE_URL" "SELECT COUNT(*) AS c FROM notes;"
  ```

  记录 throwaway 的笔记数：
  ```bash
  turso db shell backup-restore-test "SELECT COUNT(*) AS c FROM notes;"
  ```

  Expected: 两个数字一致

- [ ] **Step 4: 抽一篇笔记对比内容**

  ```bash
  set -a && source /Users/bytedance/second-brain/.env.turso-prod.local && set +a
  turso db shell "$TURSO_DATABASE_URL" "SELECT id, title FROM notes LIMIT 1;"
  # 记下 id 和 title
  turso db shell backup-restore-test "SELECT id, title FROM notes WHERE id = '<id>';"
  ```

  Expected: title 完全一致

- [ ] **Step 5: 销毁 throwaway 库**

  ```bash
  turso db destroy backup-restore-test --yes
  ```

  Expected: 销毁成功

---

## Task 7: 写 README 恢复文档

**Files:**
- Modify: `~/second-brain-backup/README.md`

- [ ] **Step 1: 覆盖 README 内容**

  ```markdown
  # second-brain-backup

  Automated daily backup of Second Brain production Turso database.

  - Design doc: `docs/specs/2026-04-09-database-backup-design.md` (in main repo)
  - Plan: `docs/plans/2026-04-09-database-backup.md` (in main repo)

  ## Schedule

  Runs every day at **UTC 20:00 / 北京时间 04:00** via GitHub Actions.
  Manual trigger: Actions tab → backup → Run workflow.

  ## Artifacts

  | Path | Purpose |
  |---|---|
  | `backup.sql` | Full SQL dump (BLOB-safe). Overwritten daily. Source of truth for disaster recovery. |
  | `notes/<id>.json` | Per-note snapshot of `notes` table |
  | `learning_notes/<id>.json` | Per-note snapshot of `learning_notes` |
  | `os_project_notes/<id>.json` | Per-note snapshot of `os_project_notes` |
  | `bookmarks/<id>.json` | Per-row snapshot of `bookmarks` |
  | `assets/<sha256>.<ext>` | Deduplicated binary assets (images) extracted from Tiptap content |
  | `manifest.json` | Last run summary (timestamps, row counts, asset count) |

  ## Disaster Recovery — restore the entire database

  1. Create a fresh Turso database:
     ```bash
     turso db create second-brain-recovered
     ```
  2. Load the dump:
     ```bash
     turso db shell second-brain-recovered < backup.sql
     ```
  3. Sanity check:
     ```bash
     turso db shell second-brain-recovered "SELECT COUNT(*) FROM notes;"
     ```
     Compare against `manifest.json` stats.
  4. Update `.env.turso-prod.local` in the main repo to point at the new db URL + token.
  5. Redeploy the Next.js app on Vercel so it picks up the new env.

  ## Fine-grained rollback — restore a single note (manual)

  1. Find the note id and the commit you want:
     ```bash
     git log -- notes/<id>.json
     git show <sha>:notes/<id>.json > restored.json
     ```
  2. If the note's `content` references `asset://<hash>.<ext>`:
     ```bash
     git show <sha>:assets/<hash>.<ext> > /tmp/<hash>.<ext>
     ```
     Convert the binary back to a base64 data URL and splice it back into the
     Tiptap JSON `src` field (`data:image/<ext>;base64,<b64>`).
  3. Apply the restored `content` either through the app editor or by running
     an `UPDATE notes SET content = ? WHERE id = ?` against the production db.

  ## Credentials

  GitHub Actions secrets required (set under repo Settings → Secrets → Actions):

  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`

  Both values are stored locally only in
  `/Users/bytedance/second-brain/.env.turso-prod.local`. Never commit these
  values. Never paste them into logs, issues, or PR comments.

  ## Local smoke test

  ```bash
  set -a && source /Users/bytedance/second-brain/.env.turso-prod.local && set +a
  OUTPUT_DIR=/tmp/backup-smoketest node scripts/split-notes.mjs
  ```
  ```

- [ ] **Step 2: Commit**

  ```bash
  cd ~/second-brain-backup
  git add README.md
  git commit -m "docs: add restore runbook"
  git push
  ```

---

## Task 8: 主 repo 留档

**Files:**
- Create: `/Users/bytedance/second-brain/docs/changelog/2026-04-09-database-backup-system.md`

- [ ] **Step 1: 写 changelog**

  创建文件：

  ```markdown
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
  - `scripts/split-notes.mjs`
  - `scripts/lib/extract-assets.mjs`
  - `scripts/lib/extract-assets.test.mjs`
  - `package.json`
  - `.gitignore`
  - `README.md`

  ## Verification

  - `node --test scripts/lib/*.test.mjs` — 7 tests passing（资源抽取单测）
  - 本地烟测：`OUTPUT_DIR=/tmp/... node scripts/split-notes.mjs` —
    产物完整、图片抽离正常、asset 文件可打开
  - GitHub Actions 手动触发 (`workflow_dispatch`) —
    job 全绿，产物已 commit 到 backup repo
  - Throwaway 恢复演练 — `turso db create` + `.dump` 灌入 +
    `SELECT COUNT(*) FROM notes;` 与生产一致

  ## Remaining risks / follow-ups

  - GitHub Secrets 必须由用户手动配置一次，AI 无法代劳
  - Token 过期时需要手动轮换（workflow 会红，GitHub 默认发邮件）
  - base64 图片抽离后的 git pack 增长需要持续观察，10 年尺度应无压力
  - 如果未来加了新的"包含用户内容 + Tiptap JSON"的表，需要手动更新
    `scripts/split-notes.mjs` 里的 `TABLES` 数组
  ```

- [ ] **Step 2: 运行主 repo 的自验证三步**

  按 CLAUDE.md 要求，任何主 repo 改动后都要跑：

  ```bash
  cd /Users/bytedance/second-brain
  pnpm build
  pnpm lint
  ```

  Expected: build 和 lint 都通过。
  （`pnpm test:e2e` 可跳过：本次改动纯粹是新增两个 md 文档，零代码影响）

- [ ] **Step 3: Commit 主 repo**

  ```bash
  cd /Users/bytedance/second-brain
  git add docs/specs/2026-04-09-database-backup-design.md \
          docs/plans/2026-04-09-database-backup.md \
          docs/changelog/2026-04-09-database-backup-system.md
  git commit -m "docs: add database backup system design, plan, and changelog"
  ```

  （push 留给用户自己决定时机，按 CLAUDE.md 规则 AI 不主动 push）

---

## Task 9: Pre-merge 验证 gate

**Files:** (no code changes)

**本任务的角色：**本项目不是 Lynx app，没有 `lynx-self-verify` 的适用场景。
但两阶段 gate 的架构必须保留，所以这一步的内容是「代码级真实性验证」：
单测 + 烟测 + workflow 手动 run，**所有断言必须通过才能进入 Task 10**。

- [ ] **Step 1: 确认单测绿**

  ```bash
  cd ~/second-brain-backup
  node --test scripts/lib/*.test.mjs
  ```

  Expected: 7 tests passing。任何一个 fail → 停，修 Task 2 的实现。

- [ ] **Step 2: 确认本地烟测绿**

  ```bash
  set -a && source /Users/bytedance/second-brain/.env.turso-prod.local && set +a
  OUTPUT_DIR=/tmp/backup-smoketest-gate node scripts/split-notes.mjs
  ls /tmp/backup-smoketest-gate
  ```

  Expected: 四个表目录 + assets/ + manifest.json 全部存在，且 `manifest.json` 里 `stats` 的行数合理。

- [ ] **Step 3: 确认 GitHub Actions 手动 run 绿**

  打开 `https://github.com/zhousiyao03-cyber/second-brain-backup/actions`，
  确认 Task 5 里手动触发的那次 run 是绿色勾。如果之前是红色，
  必须先修复后再触发一次，直到这次手动 run 是绿的。

- [ ] **Step 4: 确认 repo 里有真实产物**

  ```bash
  cd ~/second-brain-backup && git pull
  test -s backup.sql && echo "backup.sql OK"
  test -d notes && ls notes | head -3
  test -f manifest.json && cat manifest.json
  ```

  Expected: 所有检查都输出预期内容，无报错。

- [ ] **Step 5: 写 gate 验证报告**

  创建 `/Users/bytedance/second-brain/docs/specs/2026-04-09-database-backup-verify.md`：

  ```markdown
  # Backup system — pre-merge verification

  Date: <填写运行日期>

  ## Unit tests
  - `node --test scripts/lib/*.test.mjs` → <PASS/FAIL>，N tests

  ## Local smoke test
  - 命令: `OUTPUT_DIR=/tmp/backup-smoketest-gate node scripts/split-notes.mjs`
  - 输出 stats: <从 manifest.json 粘贴>
  - assets 数量: <N>
  - 人工抽查一篇 note: <id>，title=<title>，content 无 data:image 残留 ✓

  ## GitHub Actions manual run
  - Run URL: <粘贴 GitHub Actions run 链接>
  - 状态: <SUCCESS/FAILURE>
  - backup.sql size: <bytes>
  - Commit: <backup-bot 的 commit sha>

  ## Conclusion
  - [ ] 全部通过，可以进入 Task 10 (post-merge 演练 + 等待次日 scheduled run)
  ```

  填完所有 `<...>` 占位符后：

  ```bash
  cd /Users/bytedance/second-brain
  git add docs/specs/2026-04-09-database-backup-verify.md
  git commit -m "docs: backup system pre-merge verification report"
  ```

- [ ] **Step 6: 只有全部通过才进入 Task 10**

  如果任何一项失败：停，回到失败对应的 Task 修复，重跑本 gate。
  **不允许跳过。**

---

## Task 10: Post-merge 自测 gate

**Files:** (no code changes)

**前置条件：** Task 9 全绿。Task 6 的 throwaway 恢复演练已完成。

**本任务的角色：**本项目不是 Lynx app，没有 `pre-qa-self-test` 的 AB 变体 /
用户故事场景，但两阶段 gate 的架构必须保留。这一步的内容是「接受度验证 +
确认长期运行闭环」：再跑一次完整端到端 + 第二天真实 scheduled run。

- [ ] **Step 1: 对照 design doc 的 Acceptance Criteria 逐项打勾**

  打开 `docs/specs/2026-04-09-database-backup-design.md` 第 12.2 节，
  对每一项 checkbox 做真实验证：

  - [ ] `second-brain-backup` 私有 repo 已创建 → `gh repo view zhousiyao03-cyber/second-brain-backup` 成功
  - [ ] Secrets `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` 已配置 → 页面上能看到两条
  - [ ] Workflow 手动 trigger 成功跑完 (绿) → Task 9 已验证
  - [ ] repo 里存在 `backup.sql` 且 > 0 字节 → `wc -c backup.sql`
  - [ ] 四张表至少各有一个 `<id>.json` 文件 → `ls notes learning_notes os_project_notes bookmarks | head`
  - [ ] 至少有一个 `assets/<hash>.ext` 文件，且能打开 → `open assets/$(ls assets | head -1)`
  - [ ] 随机挑一篇笔记做恢复演练（throwaway 验证） → Task 6 已完成
  - [ ] 下一天的 scheduled run 自动触发成功 → 下面 Step 2 验证
  - [ ] README 里恢复步骤清晰，无歧义 → Task 7 完成

- [ ] **Step 2: 等待 + 验证次日真实 scheduled run**

  次日（北京时间 04:10 之后）打开 Actions 页面：
  1. 确认出现一次由 `schedule` 触发的新 run（不是 `workflow_dispatch`）
  2. 状态是绿色
  3. 对应的 commit 里 message 是 `backup: <昨天的 UTC 日期>`

  **如果次日没触发 / 红了**：
  - 查日志
  - 修 bug
  - 整个 plan 从 Task 9 重跑

- [ ] **Step 3: 写 post-merge 自测报告**

  创建 `/Users/bytedance/second-brain/docs/specs/2026-04-09-database-backup-self-test.md`：

  ```markdown
  # Backup system — post-merge self-test

  Date: <填写>

  ## Acceptance criteria (from design doc §12.2)
  <把 Step 1 里 9 项逐条结果粘过来，每条附实际命令输出或截图>

  ## Scheduled run verification
  - Run URL: <粘贴次日 scheduled run 的 Actions URL>
  - Trigger: schedule ✓
  - Status: <SUCCESS/FAILURE>
  - Commit: <sha> — `backup: YYYY-MM-DD`

  ## Final status
  **Status: READY FOR PRODUCTION USE** 或
  **Status: NOT READY — <reason>**
  ```

  ```bash
  cd /Users/bytedance/second-brain
  git add docs/specs/2026-04-09-database-backup-self-test.md
  git commit -m "docs: backup system post-merge self-test report"
  ```

- [ ] **Step 4: 最终 status 检查**

  报告最后一行必须是 `**Status: READY FOR PRODUCTION USE**`。
  如果是 `NOT READY`，**不能结束**：回到对应失败项所在的 Task 修复后
  从 Task 9 重新走 gate。
