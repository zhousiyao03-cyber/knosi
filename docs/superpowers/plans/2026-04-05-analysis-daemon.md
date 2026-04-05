# Analysis Daemon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move source-code analysis execution from server-side fire-and-forget to a local daemon that polls for tasks, enabling deployment to Vercel.

**Architecture:** Web UI enqueues tasks to `analysis_tasks` table via tRPC. Local daemon (merged into existing `usage:daemon`) polls `/api/analysis/claim` every 10s, executes Claude CLI locally, and posts results back via `/api/analysis/complete`. Frontend polling unchanged.

**Tech Stack:** Next.js API Routes, Drizzle ORM (SQLite/libsql), Node.js daemon script (ESM), Claude CLI

---

### Task 1: Add `analysis_tasks` table to schema

**Files:**
- Modify: `src/server/db/schema.ts:455-491` (after osProjects/osProjectNotes)

- [ ] **Step 1: Add the analysisTasks table definition**

Add after the `osProjectNotes` table in `src/server/db/schema.ts`:

```typescript
export const analysisTasks = sqliteTable("analysis_tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => osProjects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskType: text("task_type", { enum: ["analysis", "followup"] }).notNull(),
  status: text("status", { enum: ["queued", "running", "completed", "failed"] })
    .notNull()
    .default("queued"),
  repoUrl: text("repo_url").notNull(),
  question: text("question"),
  originalAnalysis: text("original_analysis"),
  result: text("result"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});
```

- [ ] **Step 2: Generate and push migration**

Run:
```bash
cd /Users/bytedance/second-brain && pnpm db:generate && pnpm db:push
```

Expected: Migration generated and applied, new `analysis_tasks` table created.

- [ ] **Step 3: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add analysis_tasks table for daemon-based analysis"
```

---

### Task 2: Create `/api/analysis/claim` route

**Files:**
- Create: `src/app/api/analysis/claim/route.ts`
- Modify: `src/proxy.ts:23` (add public path)

- [ ] **Step 1: Add `/api/analysis` to public paths in proxy.ts**

In `src/proxy.ts`, add `pathname.startsWith("/api/analysis")` to the `isPublicPath` check:

```typescript
  const isPublicPath =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/focus/ingest") ||
    pathname.startsWith("/api/focus/status") ||
    pathname.startsWith("/api/focus/pair") ||
    pathname.startsWith("/api/usage") ||
    pathname.startsWith("/api/analysis") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");
```

- [ ] **Step 2: Create the claim route**

Create `src/app/api/analysis/claim/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { analysisTasks } from "@/server/db/schema";

export async function POST() {
  // Find the oldest queued task
  const [task] = await db
    .select()
    .from(analysisTasks)
    .where(eq(analysisTasks.status, "queued"))
    .orderBy(analysisTasks.createdAt)
    .limit(1);

  if (!task) {
    return NextResponse.json({ task: null });
  }

  // Atomically claim it
  await db
    .update(analysisTasks)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(analysisTasks.id, task.id));

  return NextResponse.json({
    task: {
      id: task.id,
      projectId: task.projectId,
      userId: task.userId,
      repoUrl: task.repoUrl,
      taskType: task.taskType,
      question: task.question,
      originalAnalysis: task.originalAnalysis,
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analysis/claim/route.ts src/proxy.ts
git commit -m "feat: add /api/analysis/claim route for daemon polling"
```

---

### Task 3: Create `/api/analysis/complete` route

**Files:**
- Create: `src/app/api/analysis/complete/route.ts`

- [ ] **Step 1: Create the complete route**

Create `src/app/api/analysis/complete/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { analysisTasks, osProjectNotes, osProjects } from "@/server/db/schema";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    taskId: string;
    result?: string;
    error?: string;
  };

  if (!body.taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  // Fetch the task
  const [task] = await db
    .select()
    .from(analysisTasks)
    .where(eq(analysisTasks.id, body.taskId))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (body.error) {
    // Mark task as failed
    await db
      .update(analysisTasks)
      .set({ status: "failed", error: body.error, completedAt: new Date() })
      .where(eq(analysisTasks.id, body.taskId));

    // Update project status
    await db
      .update(osProjects)
      .set({
        analysisStatus: "failed",
        analysisError: body.error,
        updatedAt: new Date(),
      })
      .where(eq(osProjects.id, task.projectId));

    return NextResponse.json({ status: "failed" });
  }

  // Success path — persist note + update statuses
  const noteTitle =
    task.taskType === "analysis"
      ? "源码阅读笔记"
      : (task.question ?? "Follow-up").slice(0, 100);

  await db.insert(osProjectNotes).values({
    id: crypto.randomUUID(),
    projectId: task.projectId,
    userId: task.userId,
    title: noteTitle,
    content: body.result ?? "",
    plainText: body.result ?? "",
    tags: JSON.stringify(
      task.taskType === "analysis" ? ["source-analysis"] : ["followup"]
    ),
    noteType: task.taskType === "analysis" ? "analysis" : "followup",
  });

  // Mark task completed
  await db
    .update(analysisTasks)
    .set({
      status: "completed",
      result: body.result,
      completedAt: new Date(),
    })
    .where(eq(analysisTasks.id, body.taskId));

  // Update project status
  await db
    .update(osProjects)
    .set({
      analysisStatus: "completed",
      analysisError: null,
      updatedAt: new Date(),
    })
    .where(eq(osProjects.id, task.projectId));

  return NextResponse.json({ status: "completed" });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/analysis/complete/route.ts
git commit -m "feat: add /api/analysis/complete route for daemon result submission"
```

---

### Task 4: Simplify tRPC mutations to enqueue instead of execute

**Files:**
- Modify: `src/server/routers/oss-projects.ts:1-10, 249-343`

- [ ] **Step 1: Update imports — remove analyzer, add analysisTasks**

In `src/server/routers/oss-projects.ts`, replace the import line:

```typescript
// Remove this line:
import { startAnalysis, runFollowup } from "../analysis/analyzer";

// Add this import (add analysisTasks to existing schema import):
import { osProjectNotes, osProjects, analysisTasks } from "../db/schema";
```

- [ ] **Step 2: Simplify startAnalysis mutation**

Replace the `startAnalysis` mutation body (lines 249-292) with:

```typescript
  startAnalysis: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        repoUrl: z.string().trim().url().optional(),
        name: z.string().trim().optional(),
        description: z.string().trim().optional(),
        language: z.string().trim().optional(),
        starsCount: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let projectId = input.projectId;

      if (!projectId && input.repoUrl) {
        projectId = crypto.randomUUID();
        await db.insert(osProjects).values({
          id: projectId,
          userId: ctx.userId,
          name: input.name || input.repoUrl,
          repoUrl: input.repoUrl,
          description: input.description,
          language: input.language,
          starsCount: input.starsCount,
          trendingDate: new Date().toISOString().slice(0, 10),
        });
      }

      if (!projectId) {
        throw new Error("Either projectId or repoUrl is required");
      }

      const [project] = await db
        .select()
        .from(osProjects)
        .where(and(eq(osProjects.id, projectId), eq(osProjects.userId, ctx.userId)));

      if (!project?.repoUrl) {
        throw new Error("Project not found or missing repo URL");
      }

      // Enqueue analysis task
      await db.insert(analysisTasks).values({
        projectId,
        userId: ctx.userId,
        taskType: "analysis",
        status: "queued",
        repoUrl: project.repoUrl,
      });

      // Update project status for frontend polling
      await db
        .update(osProjects)
        .set({ analysisStatus: "queued", updatedAt: new Date() })
        .where(eq(osProjects.id, projectId));

      return { projectId };
    }),
```

- [ ] **Step 3: Simplify askFollowup mutation**

Replace the `askFollowup` mutation body (lines 308-343) with:

```typescript
  askFollowup: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        question: z.string().trim().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [project] = await db
        .select()
        .from(osProjects)
        .where(and(eq(osProjects.id, input.projectId), eq(osProjects.userId, ctx.userId)));

      if (!project) throw new Error("Project not found");

      // Fetch original analysis for context
      const [analysisNote] = await db
        .select({ plainText: osProjectNotes.plainText })
        .from(osProjectNotes)
        .where(
          and(
            eq(osProjectNotes.projectId, input.projectId),
            eq(osProjectNotes.noteType, "analysis")
          )
        )
        .orderBy(osProjectNotes.createdAt)
        .limit(1);

      // Enqueue followup task
      await db.insert(analysisTasks).values({
        projectId: input.projectId,
        userId: ctx.userId,
        taskType: "followup",
        status: "queued",
        repoUrl: project.repoUrl ?? "",
        question: input.question,
        originalAnalysis: analysisNote?.plainText ?? "",
      });

      // Update project status for frontend polling
      await db
        .update(osProjects)
        .set({ analysisStatus: "queued", updatedAt: new Date() })
        .where(eq(osProjects.id, input.projectId));
    }),
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/oss-projects.ts
git commit -m "refactor: simplify tRPC mutations to enqueue tasks instead of executing"
```

---

### Task 5: Update frontend status values

**Files:**
- Modify: `src/app/(app)/projects/[id]/page.tsx:39-47, 112-113, 209-218`

- [ ] **Step 1: Update polling condition**

In `src/app/(app)/projects/[id]/page.tsx`, update the refetchInterval callback (line 42-44):

```typescript
      refetchInterval: (query) => {
        const status = query.state.data?.analysisStatus;
        return status === "queued" || status === "running" ? 5000 : false;
      },
```

- [ ] **Step 2: Update canStartAnalysis check**

The existing check at line 112-113 already works — it checks `!analysisStatus`, which is null when no analysis has run. No change needed.

- [ ] **Step 3: Update the analysis status banner**

Replace the banner block (lines 209-218):

```tsx
      {(analysisStatus === "queued" || analysisStatus === "running") && (
        <div className="flex items-center gap-3 rounded-2xl bg-blue-50 px-5 py-4 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Loader2 size={16} className="animate-spin shrink-0" />
          <span>
            {analysisStatus === "queued"
              ? "Analysis queued — waiting for local daemon to pick it up…"
              : "Analysing repository with Claude — this may take a few minutes…"}
          </span>
        </div>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/projects/[id]/page.tsx
git commit -m "feat: update frontend to use queued/running status values"
```

---

### Task 6: Add analysis polling loop to daemon

**Files:**
- Modify: `tools/usage-reporter/report.mjs`

- [ ] **Step 1: Add analysis constants and helpers at the top**

After the existing constants section (around line 20), add:

```javascript
const ANALYSIS_POLL_INTERVAL_MS = 10 * 1000; // 10 seconds
const MAX_CONCURRENT_ANALYSIS = 3;
let analysisRunning = 0;
```

- [ ] **Step 2: Add the analysis prompt functions**

Before the `// Main` section (around line 168), add:

```javascript
// ---------------------------------------------------------------------------
// Analysis — Prompt builders
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(repoUrl) {
  return `对本目录中的开源项目（${repoUrl}）进行系统性源码阅读，产出一篇结构化的学习笔记。

## 阅读流程

按以下顺序逐层深入：

### 第一层：项目全貌
1. 读 README、CONTRIBUTING、ARCHITECTURE（如有）
2. 读依赖清单，识别核心依赖和技术选型
3. 画出顶层目录树（2-3 层深度），标注每个目录的职责
4. 回答：这个项目解决什么问题？面向谁？核心入口在哪？

### 第二层：架构与数据流
1. 找到程序入口，追踪启动流程
2. 识别核心抽象（关键 interface / trait / class / type），画出依赖关系
3. 追踪一个最典型的用户操作，完整走通数据流
4. 识别分层策略：哪些是对外 API、哪些是内部模块
5. 回答：架构上最重要的设计决策是什么？

### 第三层：核心模块深挖
针对 2-3 个最核心的模块：
1. 逐文件阅读，理解内部实现
2. 标注巧妙的设计模式、性能优化手法、错误处理策略
3. 分析 trade-off：为什么这样写而不是更简单的写法
4. 识别防御性编程、边界处理、并发控制等细节

### 第四层：测试与工程化
1. 测试策略：单元 / 集成 / E2E 比例
2. CI/CD 和发布流程
3. 代码质量工具和规范

## 输出格式

输出一篇 Markdown 文章，结构如下：

# [项目名] 源码阅读笔记

## 一句话总结
> 用一句话概括这个项目的本质

## 项目画像
- 解决的问题：
- 目标用户：
- 技术栈：
- 仓库规模：约 X 文件 / X 行代码

## 架构概览
（附目录结构图 + 核心模块关系图，用 mermaid）

## 核心数据流
（追踪一个典型操作的完整路径，附代码引用）

## 难点与亮点

### 难点 1：[标题]
- 问题是什么
- 他们怎么解决的
- 关键代码位置

### 亮点 1：[标题]
- 这个设计好在哪
- 对比常规做法的优势

（难点和亮点各列 3-5 个）

## 设计决策清单
| 决策 | 选择 | 备选方案 | 为什么选这个 |
|------|------|----------|-------------|

## 值得偷师的模式
（可迁移的具体 pattern，附代码片段）

## 疑问
（没想通的点，留待研究）

## 阅读原则
- 每个结论附带具体文件路径和行号
- 重 Why 轻 What
- 没看懂的标注为疑问，不编造`;
}

function buildFollowupPrompt(originalAnalysis, question) {
  return `你之前对这个项目生成了以下源码分析文章：

---
${originalAnalysis}
---

用户的追问：${question}

请基于项目源码回答这个问题。直接阅读源码文件来给出准确回答，附带具体文件路径和行号。输出 Markdown 格式。`;
}
```

- [ ] **Step 3: Add clone and Claude spawn helpers**

After the prompt functions, add:

```javascript
// ---------------------------------------------------------------------------
// Analysis — Clone & Execute
// ---------------------------------------------------------------------------

import { execSync, spawn as cpSpawn } from "child_process";
import { existsSync } from "fs";
import { tmpdir } from "os";

const ANALYSIS_BASE_DIR = join(tmpdir(), "source-readings");

function repoSlug(repoUrl) {
  try {
    const url = new URL(repoUrl);
    return url.pathname
      .replace(/^\//, "")
      .replace(/\//g, "__")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
  } catch {
    return repoUrl.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  }
}

function cloneRepo(repoUrl) {
  const dest = join(ANALYSIS_BASE_DIR, repoSlug(repoUrl));
  if (!existsSync(dest)) {
    execSync(`mkdir -p "${ANALYSIS_BASE_DIR}"`);
    execSync(`git clone --depth=1 "${repoUrl}" "${dest}"`, {
      timeout: 120_000,
      stdio: "pipe",
    });
  }
  return dest;
}

function spawnClaude(prompt, cwd) {
  return new Promise((resolve, reject) => {
    const child = cpSpawn(
      "claude",
      ["-p", prompt, "--allowedTools", "Read,Grep,Glob,Bash", "--output-format", "text"],
      { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] }
    );

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        reject(new Error(`claude exited with code ${code}${stderr ? `: ${stderr}` : ""}`));
        return;
      }
      resolve(Buffer.concat(stdoutChunks).toString("utf8"));
    });
  });
}
```

- [ ] **Step 4: Add the analysis task handler**

After the clone/spawn helpers, add:

```javascript
// ---------------------------------------------------------------------------
// Analysis — Task handler
// ---------------------------------------------------------------------------

async function handleAnalysisTask(task) {
  console.log(`[${timestamp()}] 🔬 开始分析: ${task.repoUrl} (${task.taskType})`);

  try {
    const repoDir = cloneRepo(task.repoUrl);

    const prompt =
      task.taskType === "analysis"
        ? buildAnalysisPrompt(task.repoUrl)
        : buildFollowupPrompt(task.originalAnalysis || "", task.question || "");

    const result = await spawnClaude(prompt, repoDir);

    // Report success
    const res = await fetch(`${SERVER_URL}/api/analysis/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, result }),
    });

    if (!res.ok) {
      throw new Error(`Complete API returned ${res.status}: ${await res.text()}`);
    }

    console.log(`[${timestamp()}] ✅ 分析完成: ${task.repoUrl}`);
  } catch (err) {
    console.error(`[${timestamp()}] ❌ 分析失败: ${task.repoUrl}`, err.message);

    // Report failure
    await fetch(`${SERVER_URL}/api/analysis/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, error: err.message }),
    }).catch(() => {});
  } finally {
    analysisRunning--;
  }
}
```

- [ ] **Step 5: Add the analysis poll loop**

After the task handler, add:

```javascript
// ---------------------------------------------------------------------------
// Analysis — Poll loop
// ---------------------------------------------------------------------------

async function pollAnalysisTasks() {
  if (analysisRunning >= MAX_CONCURRENT_ANALYSIS) return;

  try {
    const res = await fetch(`${SERVER_URL}/api/analysis/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) return;

    const data = await res.json();
    if (!data.task) return;

    analysisRunning++;
    // Fire and forget — don't block the poll loop
    handleAnalysisTask(data.task).catch(() => {});
  } catch {
    // Silently skip — server may be unreachable
  }
}
```

- [ ] **Step 6: Wire the analysis poll into the daemon main block**

In the daemon mode section (the `else` branch around line 174), add the analysis interval after the existing usage interval:

```javascript
  // Analysis task polling
  setInterval(async () => {
    await pollAnalysisTasks();
  }, ANALYSIS_POLL_INTERVAL_MS);

  console.log(`   分析任务轮询间隔: ${ANALYSIS_POLL_INTERVAL_MS / 1000}s`);
```

- [ ] **Step 7: Commit**

```bash
git add tools/usage-reporter/report.mjs
git commit -m "feat: add analysis task polling loop to usage daemon"
```

---

### Task 7: Delete old server-side analyzer

**Files:**
- Delete: `src/server/analysis/analyzer.ts`
- Keep: `src/server/analysis/prompt.ts` (reference only, can delete later)

- [ ] **Step 1: Delete analyzer.ts**

```bash
rm src/server/analysis/analyzer.ts
```

- [ ] **Step 2: Verify no remaining imports**

Run:
```bash
cd /Users/bytedance/second-brain && grep -r "from.*analysis/analyzer" src/
```

Expected: No output (the import was already removed in Task 4).

- [ ] **Step 3: Commit**

```bash
git add -A src/server/analysis/analyzer.ts
git commit -m "chore: remove server-side analyzer (replaced by daemon)"
```

---

### Task 8: Build and verify

**Files:** None (verification only)

- [ ] **Step 1: TypeScript build check**

Run:
```bash
cd /Users/bytedance/second-brain && pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: ESLint check**

Run:
```bash
cd /Users/bytedance/second-brain && pnpm lint
```

Expected: No errors.

- [ ] **Step 3: Final commit if any fixes needed**

If build/lint required fixes, commit them:

```bash
git add -A
git commit -m "fix: resolve build/lint issues from analysis daemon migration"
```
