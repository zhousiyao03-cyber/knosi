# Source Code Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub Trending discovery + Claude CLI-powered source code analysis to the existing `/projects` module, enabling a "discover → analyze → follow-up → learn" workflow.

**Architecture:** Extend the existing `osProjects` / `osProjectNotes` schema with analysis fields. Add a server-side analysis engine that spawns `claude` CLI to read cloned repos. Frontend gets a dual-tab layout (My Projects / Discover) with trending list, manual URL input, and follow-up questioning.

**Tech Stack:** cheerio (HTML parsing), child_process (Claude CLI spawn), GitHub REST API (repo info), existing tRPC + Drizzle + React stack.

---

## File Structure

```
src/server/analysis/
├── trending.ts          # GitHub Trending scraper + in-memory cache
├── github.ts            # GitHub repo info fetcher (REST API)
├── analyzer.ts          # Claude CLI spawner + concurrency control
└── prompt.ts            # Analysis & follow-up prompt templates

src/server/routers/
└── oss-projects.ts      # MODIFY: add trending/analysis/followup routes

src/server/db/
└── schema.ts            # MODIFY: add fields to osProjects + osProjectNotes

src/app/(app)/projects/
├── page.tsx             # MODIFY: dual-tab layout
├── discover-tab.tsx     # CREATE: Trending list + URL input
└── [id]/page.tsx        # MODIFY: analysis status + follow-up UI + note grouping
```

---

### Task 1: Install cheerio

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install cheerio**

```bash
pnpm add cheerio
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('cheerio'); console.log('cheerio OK')"
```

Expected: `cheerio OK`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add cheerio for HTML parsing"
```

---

### Task 2: Schema changes — add analysis fields

**Files:**
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Add fields to osProjects table**

In `src/server/db/schema.ts`, add these fields to the `osProjects` table definition, after the `aiSummary` field:

```typescript
analysisStatus: text("analysis_status"),  // null | pending | analyzing | completed | failed
analysisError: text("analysis_error"),
starsCount: integer("stars_count"),
trendingDate: text("trending_date"),
```

- [ ] **Step 2: Add noteType field to osProjectNotes table**

In the `osProjectNotes` table definition, add after the `tags` field:

```typescript
noteType: text("note_type").default("manual"),  // manual | analysis | followup
```

- [ ] **Step 3: Generate and push migration**

```bash
pnpm db:generate
pnpm db:push
```

- [ ] **Step 4: Verify schema**

```bash
pnpm build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add analysis fields to osProjects and osProjectNotes schema"
```

---

### Task 3: Trending scraper service

**Files:**
- Create: `src/server/analysis/trending.ts`

- [x] **Step 1: Create the trending scraper**

Create `src/server/analysis/trending.ts`:

```typescript
import * as cheerio from "cheerio";

export interface TrendingRepo {
  fullName: string;
  description: string;
  language: string | null;
  stars: number;
  periodStars: number;
  url: string;
}

type TrendingSince = "daily" | "weekly" | "monthly";

interface CacheEntry {
  data: TrendingRepo[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

function cacheKey(since: TrendingSince, language: string) {
  return `${since}:${language}`;
}

function parseStarCount(text: string): number {
  const cleaned = text.trim().replace(/,/g, "");
  if (cleaned.endsWith("k")) {
    return Math.round(parseFloat(cleaned) * 1000);
  }
  return parseInt(cleaned, 10) || 0;
}

export async function fetchTrending(
  since: TrendingSince = "daily",
  language = ""
): Promise<TrendingRepo[]> {
  const key = cacheKey(since, language);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({ since });
  if (language) {
    params.set("language", language);
  }

  const url = `https://github.com/trending?${params}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SecondBrain/1.0)",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub trending fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const repos: TrendingRepo[] = [];

  $("article.Box-row").each((_, el) => {
    const $el = $(el);
    const fullName = $el.find("h2 a").attr("href")?.slice(1)?.trim() ?? "";
    if (!fullName) return;

    const description = $el.find("p").first().text().trim();
    const languageEl = $el.find('[itemprop="programmingLanguage"]');
    const language = languageEl.length ? languageEl.text().trim() : null;

    const starLinks = $el.find("a.Link--muted");
    const starsText = starLinks.first().text().trim();
    const stars = parseStarCount(starsText);

    const periodStarsText = $el.find(".float-sm-right, .d-inline-block.float-sm-right").text().trim();
    const periodStarsMatch = periodStarsText.match(/([\d,]+)\s+stars?\s+/i);
    const periodStars = periodStarsMatch ? parseInt(periodStarsMatch[1].replace(/,/g, ""), 10) : 0;

    repos.push({
      fullName,
      description,
      language,
      stars,
      periodStars,
      url: `https://github.com/${fullName}`,
    });
  });

  cache.set(key, { data: repos, timestamp: Date.now() });
  return repos;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/server/analysis/trending.ts
git commit -m "feat: add GitHub trending scraper with in-memory cache"
```

---

### Task 4: GitHub repo info fetcher

**Files:**
- Create: `src/server/analysis/github.ts`

- [ ] **Step 1: Create the GitHub repo info fetcher**

Create `src/server/analysis/github.ts`:

```typescript
export interface RepoInfo {
  fullName: string;
  name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
}

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(input.trim());
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    // Try owner/repo format
    const parts = input.trim().split("/").filter(Boolean);
    if (parts.length === 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  }
}

export async function fetchRepoInfo(input: string): Promise<RepoInfo> {
  const parsed = parseGitHubUrl(input);
  if (!parsed) {
    throw new Error("Invalid GitHub URL or owner/repo format");
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "SecondBrain/1.0",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    { headers }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository not found: ${parsed.owner}/${parsed.repo}`);
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    full_name: string;
    name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    html_url: string;
  };

  return {
    fullName: data.full_name,
    name: data.name,
    description: data.description ?? "",
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    url: data.html_url,
  };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/server/analysis/github.ts
git commit -m "feat: add GitHub repo info fetcher via REST API"
```

---

### Task 5: Prompt templates

**Files:**
- Create: `src/server/analysis/prompt.ts`

- [ ] **Step 1: Create prompt templates**

Create `src/server/analysis/prompt.ts`:

```typescript
export function buildAnalysisPrompt(repoUrl: string): string {
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

export function buildFollowupPrompt(
  originalAnalysis: string,
  question: string
): string {
  return `你之前对这个项目生成了以下源码分析文章：

---
${originalAnalysis}
---

用户的追问：${question}

请基于项目源码回答这个问题。直接阅读源码文件来给出准确回答，附带具体文件路径和行号。输出 Markdown 格式。`;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/server/analysis/prompt.ts
git commit -m "feat: add source code analysis prompt templates"
```

---

### Task 6: Claude CLI analyzer service

**Files:**
- Create: `src/server/analysis/analyzer.ts`

- [x] **Step 1: Create the analyzer service**

Create `src/server/analysis/analyzer.ts`:

```typescript
import { spawn, execSync } from "child_process";
import { existsSync, rmSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { osProjects, osProjectNotes } from "../db/schema";
import { buildAnalysisPrompt, buildFollowupPrompt } from "./prompt";

const BASE_DIR = join(tmpdir(), "source-readings");
const MAX_CONCURRENT = 3;
const REPO_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function repoDir(projectId: string) {
  return join(BASE_DIR, projectId);
}

function ensureBaseDir() {
  if (!existsSync(BASE_DIR)) {
    execSync(`mkdir -p "${BASE_DIR}"`);
  }
}

function cleanupExpired() {
  if (!existsSync(BASE_DIR)) return;
  const now = Date.now();
  for (const entry of readdirSync(BASE_DIR)) {
    const dir = join(BASE_DIR, entry);
    try {
      const stat = statSync(dir);
      if (now - stat.mtimeMs > REPO_TTL_MS) {
        rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }
}

function spawnClaude(prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", prompt, "--allowedTools", "Read,Grep,Glob,Bash", "--output-format", "text"],
      { cwd, stdio: ["ignore", "pipe", "pipe"], detached: true }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });
  });
}

async function cloneRepo(repoUrl: string, dest: string) {
  if (existsSync(dest)) return;
  ensureBaseDir();
  execSync(`git clone --depth=1 "${repoUrl}" "${dest}"`, {
    timeout: 120_000,
    stdio: "ignore",
  });
}

async function getAnalyzingCount(): Promise<number> {
  const rows = await db
    .select({ id: osProjects.id })
    .from(osProjects)
    .where(eq(osProjects.analysisStatus, "analyzing"));
  return rows.length;
}

async function processPendingQueue() {
  const count = await getAnalyzingCount();
  if (count >= MAX_CONCURRENT) return;

  const [next] = await db
    .select()
    .from(osProjects)
    .where(eq(osProjects.analysisStatus, "pending"))
    .orderBy(osProjects.createdAt)
    .limit(1);

  if (next && next.repoUrl) {
    runAnalysis(next.id, next.repoUrl, next.userId).catch(() => {});
  }
}

async function runAnalysis(projectId: string, repoUrl: string, userId: string) {
  try {
    await db
      .update(osProjects)
      .set({ analysisStatus: "analyzing" })
      .where(eq(osProjects.id, projectId));

    cleanupExpired();

    const dest = repoDir(projectId);
    await cloneRepo(repoUrl, dest);

    const prompt = buildAnalysisPrompt(repoUrl);
    const markdown = await spawnClaude(prompt, dest);

    const noteId = crypto.randomUUID();
    await db.insert(osProjectNotes).values({
      id: noteId,
      projectId,
      userId,
      title: `源码阅读笔记`,
      content: markdown,
      plainText: markdown.slice(0, 5000),
      tags: JSON.stringify(["source-analysis"]),
      noteType: "analysis",
    });

    await db
      .update(osProjects)
      .set({ analysisStatus: "completed", analysisError: null, updatedAt: new Date() })
      .where(eq(osProjects.id, projectId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(osProjects)
      .set({ analysisStatus: "failed", analysisError: message })
      .where(eq(osProjects.id, projectId));
  } finally {
    processPendingQueue();
  }
}

export async function startAnalysis(projectId: string, repoUrl: string, userId: string) {
  const count = await getAnalyzingCount();

  if (count >= MAX_CONCURRENT) {
    await db
      .update(osProjects)
      .set({ analysisStatus: "pending" })
      .where(eq(osProjects.id, projectId));
    return { status: "pending" as const };
  }

  runAnalysis(projectId, repoUrl, userId).catch(() => {});
  return { status: "analyzing" as const };
}

export async function runFollowup(
  projectId: string,
  userId: string,
  question: string,
  originalAnalysis: string,
  repoUrl: string
) {
  const dest = repoDir(projectId);

  if (!existsSync(dest) && repoUrl) {
    ensureBaseDir();
    await cloneRepo(repoUrl, dest);
  }

  const prompt = buildFollowupPrompt(originalAnalysis, question);
  const cwd = existsSync(dest) ? dest : process.cwd();
  const markdown = await spawnClaude(prompt, cwd);

  const noteId = crypto.randomUUID();
  await db.insert(osProjectNotes).values({
    id: noteId,
    projectId,
    userId,
    title: question.slice(0, 100),
    content: markdown,
    plainText: markdown.slice(0, 5000),
    tags: JSON.stringify(["followup"]),
    noteType: "followup",
  });

  await db
    .update(osProjects)
    .set({ updatedAt: new Date() })
    .where(and(eq(osProjects.id, projectId), eq(osProjects.userId, userId)));

  return { noteId };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/server/analysis/analyzer.ts
git commit -m "feat: add Claude CLI analyzer with concurrency control"
```

---

### Task 7: tRPC router — add trending, analysis, and followup routes

**Files:**
- Modify: `src/server/routers/oss-projects.ts`

- [ ] **Step 1: Add imports**

At the top of `src/server/routers/oss-projects.ts`, add:

```typescript
import { fetchTrending } from "../analysis/trending";
import { fetchRepoInfo } from "../analysis/github";
import { startAnalysis, runFollowup } from "../analysis/analyzer";
```

- [ ] **Step 2: Add trending route**

Add inside the `router({...})` block, after the `deleteNote` route:

```typescript
  trending: protectedProcedure
    .input(
      z.object({
        since: z.enum(["daily", "weekly", "monthly"]).default("daily"),
        language: z.string().trim().optional(),
      })
    )
    .query(async ({ input }) => {
      return fetchTrending(input.since, input.language ?? "");
    }),
```

- [ ] **Step 3: Add fetchRepoInfo route**

```typescript
  fetchRepoInfo: protectedProcedure
    .input(z.object({ url: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      return fetchRepoInfo(input.url);
    }),
```

- [ ] **Step 4: Add startAnalysis route**

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
        // Create project first
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

      const result = await startAnalysis(projectId, project.repoUrl, ctx.userId);
      return { projectId, ...result };
    }),
```

- [ ] **Step 5: Add analysisStatus route**

```typescript
  analysisStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      const [project] = await db
        .select({
          analysisStatus: osProjects.analysisStatus,
          analysisError: osProjects.analysisError,
        })
        .from(osProjects)
        .where(and(eq(osProjects.id, input.projectId), eq(osProjects.userId, ctx.userId)));

      return project ?? { analysisStatus: null, analysisError: null };
    }),
```

- [ ] **Step 6: Add askFollowup route**

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

      // Find latest analysis note
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

      const originalAnalysis = analysisNote?.plainText ?? "";
      return runFollowup(
        input.projectId,
        ctx.userId,
        input.question,
        originalAnalysis,
        project.repoUrl ?? ""
      );
    }),
```

- [ ] **Step 7: Verify it compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/server/routers/oss-projects.ts
git commit -m "feat: add trending, analysis, and followup tRPC routes"
```

---

### Task 8: Frontend — Dual-tab layout on /projects

**Files:**
- Modify: `src/app/(app)/projects/page.tsx`

- [ ] **Step 1: Add tab state and layout**

Rewrite `src/app/(app)/projects/page.tsx` to wrap existing content in a tab:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderGit2, Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DiscoverTab } from "./discover-tab";

type Tab = "projects" | "discover";

export default function ProjectsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [language, setLanguage] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading } = trpc.ossProjects.listProjects.useQuery();
  const createProject = trpc.ossProjects.createProject.useMutation({
    onSuccess: async (data) => {
      await utils.ossProjects.listProjects.invalidate();
      setShowForm(false);
      setName("");
      setRepoUrl("");
      setLanguage("");
      setDescription("");
      router.push(`/projects/${data.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
            Open source projects
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Save architecture notes, code-reading findings, and reusable patterns.
          </p>
        </div>
        {activeTab === "projects" && (
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            Add project
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-900">
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "projects"
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
              : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          My Projects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("discover")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "discover"
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
              : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          Discover
        </button>
      </div>

      {activeTab === "projects" ? (
        <>
          {showForm && (
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>Project name</span>
                  <input
                    aria-label="Project name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-transparent px-3 py-2 outline-none focus:border-blue-400 dark:border-stone-700"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>Repository URL</span>
                  <input
                    aria-label="Repository URL"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-transparent px-3 py-2 outline-none focus:border-blue-400 dark:border-stone-700"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>Language</span>
                  <input
                    aria-label="Language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-transparent px-3 py-2 outline-none focus:border-blue-400 dark:border-stone-700"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>Description</span>
                  <input
                    aria-label="Description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-transparent px-3 py-2 outline-none focus:border-blue-400 dark:border-stone-700"
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || createProject.isPending}
                  onClick={() =>
                    createProject.mutate({ name, repoUrl, language, description })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950"
                >
                  {createProject.isPending && <Loader2 size={14} className="animate-spin" />}
                  Create project
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-sm text-stone-500">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-stone-300 bg-white/70 px-6 py-16 text-center text-stone-500 dark:border-stone-700 dark:bg-stone-950/50 dark:text-stone-400">
              <FolderGit2 className="mx-auto mb-4 h-10 w-10 opacity-50" />
              <p className="text-base font-medium">No tracked projects yet</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="rounded-[28px] border border-stone-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-stone-800 dark:bg-stone-950 dark:hover:border-stone-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                        {project.name}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                        {project.language || "Unknown language"}
                      </p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-300">
                      {project.noteCount} {project.noteCount === 1 ? "note" : "notes"}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">
                    {project.description || "No description yet."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.topTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <DiscoverTab />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles (will fail until Task 9)**

This is expected — `discover-tab.tsx` doesn't exist yet. Proceed to Task 9.

---

### Task 9: Frontend — Discover tab component

**Files:**
- Create: `src/app/(app)/projects/discover-tab.tsx`

- [ ] **Step 1: Create DiscoverTab component**

Create `src/app/(app)/projects/discover-tab.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Search, Star, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";

const LANGUAGES = [
  "",
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "c++",
  "swift",
  "kotlin",
];

const LANGUAGE_LABELS: Record<string, string> = {
  "": "All Languages",
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  rust: "Rust",
  go: "Go",
  java: "Java",
  "c++": "C++",
  swift: "Swift",
  kotlin: "Kotlin",
};

type Since = "daily" | "weekly" | "monthly";

const SINCE_LABELS: Record<Since, string> = {
  daily: "Today",
  weekly: "This Week",
  monthly: "This Month",
};

export function DiscoverTab() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [since, setSince] = useState<Since>("daily");
  const [language, setLanguage] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const { data: trending = [], isLoading: trendingLoading } =
    trpc.ossProjects.trending.useQuery({ since, language });

  const { data: repoInfo, isFetching: repoFetching } =
    trpc.ossProjects.fetchRepoInfo.useQuery(
      { url: urlInput },
      { enabled: urlInput.includes("github.com/") }
    );

  const startAnalysis = trpc.ossProjects.startAnalysis.useMutation({
    onSuccess: (data) => {
      utils.ossProjects.listProjects.invalidate();
      router.push(`/projects/${data.projectId}`);
    },
  });

  function handleAnalyzeUrl() {
    if (!repoInfo) return;
    startAnalysis.mutate({
      repoUrl: repoInfo.url,
      name: repoInfo.fullName,
      description: repoInfo.description,
      language: repoInfo.language ?? undefined,
      starsCount: repoInfo.stars,
    });
  }

  function handleAnalyzeTrending(repo: {
    fullName: string;
    description: string;
    language: string | null;
    stars: number;
    url: string;
  }) {
    startAnalysis.mutate({
      repoUrl: repo.url,
      name: repo.fullName,
      description: repo.description,
      language: repo.language ?? undefined,
      starsCount: repo.stars,
    });
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste a GitHub repo URL (e.g. https://github.com/vercel/next.js)"
              className="w-full rounded-xl border border-stone-200 bg-transparent py-2 pl-10 pr-3 text-sm outline-none focus:border-blue-400 dark:border-stone-700"
            />
          </div>
          <button
            type="button"
            disabled={!repoInfo || startAnalysis.isPending}
            onClick={handleAnalyzeUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {startAnalysis.isPending && <Loader2 size={14} className="animate-spin" />}
            Analyze
          </button>
        </div>
        {repoFetching && (
          <p className="mt-2 text-xs text-stone-400">Loading repo info...</p>
        )}
        {repoInfo && !repoFetching && (
          <div className="mt-3 rounded-xl bg-stone-50 p-3 dark:bg-stone-900">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-stone-900 dark:text-stone-100">
                {repoInfo.fullName}
              </span>
              <span className="flex items-center gap-1 text-xs text-stone-500">
                <Star size={12} /> {repoInfo.stars.toLocaleString()}
              </span>
              {repoInfo.language && (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs dark:bg-stone-800">
                  {repoInfo.language}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500">{repoInfo.description}</p>
          </div>
        )}
      </div>

      {/* Trending header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100">
          <TrendingUp size={18} />
          <span className="font-semibold">Trending</span>
        </div>
        <div className="flex gap-2">
          {/* Since toggle */}
          <div className="flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-900">
            {(Object.keys(SINCE_LABELS) as Since[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSince(s)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  since === s
                    ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400"
                }`}
              >
                {SINCE_LABELS[s]}
              </button>
            ))}
          </div>
          {/* Language select */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs dark:border-stone-700 dark:bg-stone-900"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang] ?? lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trending list */}
      {trendingLoading ? (
        <div className="py-12 text-center text-sm text-stone-500">
          Loading trending repos...
        </div>
      ) : trending.length === 0 ? (
        <div className="py-12 text-center text-sm text-stone-500">
          No trending repos found.
        </div>
      ) : (
        <div className="space-y-3">
          {trending.map((repo) => (
            <div
              key={repo.fullName}
              className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-stone-900 dark:text-stone-100">
                      {repo.fullName}
                    </span>
                    {repo.language && (
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs dark:bg-stone-800">
                        {repo.language}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">
                    {repo.description || "No description"}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                      <Star size={12} /> {repo.stars.toLocaleString()}
                    </span>
                    {repo.periodStars > 0 && (
                      <span className="text-green-600 dark:text-green-400">
                        +{repo.periodStars.toLocaleString()} {SINCE_LABELS[since].toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-900"
                  >
                    <ExternalLink size={12} /> GitHub
                  </a>
                  <button
                    type="button"
                    onClick={() => handleAnalyzeTrending(repo)}
                    disabled={startAnalysis.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {startAnalysis.isPending && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    Add & Analyze
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/projects/page.tsx src/app/\(app\)/projects/discover-tab.tsx
git commit -m "feat: add dual-tab layout with Discover tab for trending and URL input"
```

---

### Task 10: Frontend — Project detail page enhancements

**Files:**
- Modify: `src/app/(app)/projects/[id]/page.tsx`

- [x] **Step 1: Add analysis status, follow-up input, and note grouping**

Rewrite `src/app/(app)/projects/[id]/page.tsx`:

```typescript
"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";

const NOTE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  analysis: { label: "Source Analysis", icon: "📊" },
  followup: { label: "Follow-up", icon: "💬" },
  manual: { label: "Notes", icon: "✍️" },
};

const NOTE_TYPE_ORDER = ["analysis", "followup", "manual"];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [followupQuestion, setFollowupQuestion] = useState("");

  const { data: project, isLoading: projectLoading } =
    trpc.ossProjects.getProject.useQuery({ id });
  const { data: notes = [], isLoading: notesLoading } =
    trpc.ossProjects.listNotes.useQuery({ projectId: id, tag: selectedTag });

  // Poll analysis status
  const { data: analysisInfo } = trpc.ossProjects.analysisStatus.useQuery(
    { projectId: id },
    {
      refetchInterval: (query) => {
        const status = query.state.data?.analysisStatus;
        return status === "analyzing" || status === "pending" ? 5000 : false;
      },
    }
  );

  const analysisStatus = analysisInfo?.analysisStatus ?? project?.analysisStatus;

  // Refresh notes when analysis completes
  useEffect(() => {
    if (analysisStatus === "completed") {
      utils.ossProjects.listNotes.invalidate({ projectId: id });
      utils.ossProjects.getProject.invalidate({ id });
    }
  }, [analysisStatus, id, utils]);

  const createNote = trpc.ossProjects.createNote.useMutation({
    onSuccess: async (data) => {
      await utils.ossProjects.listNotes.invalidate({ projectId: id });
      router.push(`/projects/${id}/notes/${data.id}`);
    },
  });

  const askFollowup = trpc.ossProjects.askFollowup.useMutation({
    onSuccess: async (data) => {
      setFollowupQuestion("");
      await utils.ossProjects.listNotes.invalidate({ projectId: id });
      router.push(`/projects/${id}/notes/${data.noteId}`);
    },
  });

  const startAnalysis = trpc.ossProjects.startAnalysis.useMutation({
    onSuccess: () => {
      utils.ossProjects.analysisStatus.invalidate({ projectId: id });
      utils.ossProjects.getProject.invalidate({ id });
    },
  });

  const groupedNotes = useMemo(() => {
    const groups: Record<string, typeof notes> = {};
    for (const note of notes) {
      const type = (note as { noteType?: string }).noteType || "manual";
      if (!groups[type]) groups[type] = [];
      groups[type].push(note);
    }
    return groups;
  }, [notes]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) {
      if (!note.tags) continue;
      try {
        for (const tag of JSON.parse(note.tags) as string[]) {
          if (typeof tag === "string") set.add(tag);
        }
      } catch {
        continue;
      }
    }
    return [...set];
  }, [notes]);

  if (projectLoading) {
    return <div className="py-12 text-sm text-stone-500">Loading project...</div>;
  }

  if (!project) {
    return <div className="py-12 text-center text-stone-500">Project not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-stone-900 dark:text-stone-100">
            {project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500 dark:text-stone-400">
            {project.description || "No description yet."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-500 dark:text-stone-400">
            {project.language && (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 dark:bg-stone-900">
                {project.language}
              </span>
            )}
            {project.starsCount != null && (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 dark:bg-stone-900">
                ⭐ {project.starsCount.toLocaleString()}
              </span>
            )}
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                {project.repoUrl}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {project.repoUrl && !analysisStatus && (
            <button
              type="button"
              onClick={() => startAnalysis.mutate({ projectId: id })}
              disabled={startAnalysis.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {startAnalysis.isPending && <Loader2 size={14} className="animate-spin" />}
              Analyze
            </button>
          )}
          <button
            type="button"
            onClick={() => createNote.mutate({ projectId: id, title: "" })}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            Add note
          </button>
        </div>
      </div>

      {/* Analysis status */}
      {(analysisStatus === "analyzing" || analysisStatus === "pending") && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <Loader2 size={18} className="animate-spin text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {analysisStatus === "pending"
              ? "Queued — waiting for other analyses to finish..."
              : "Analyzing source code with Claude... This may take a few minutes."}
          </span>
        </div>
      )}
      {analysisStatus === "failed" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-300">
            Analysis failed: {analysisInfo?.analysisError || "Unknown error"}
          </p>
          <button
            type="button"
            onClick={() => startAnalysis.mutate({ projectId: id })}
            className="mt-2 text-sm font-medium text-red-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Follow-up input (only when analysis is completed) */}
      {analysisStatus === "completed" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
          <div className="flex gap-3">
            <input
              type="text"
              value={followupQuestion}
              onChange={(e) => setFollowupQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && followupQuestion.trim() && !askFollowup.isPending) {
                  askFollowup.mutate({ projectId: id, question: followupQuestion.trim() });
                }
              }}
              placeholder="Ask a follow-up question about this project..."
              className="flex-1 rounded-xl border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-stone-700"
            />
            <button
              type="button"
              disabled={!followupQuestion.trim() || askFollowup.isPending}
              onClick={() =>
                askFollowup.mutate({ projectId: id, question: followupQuestion.trim() })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950"
            >
              {askFollowup.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
          {askFollowup.isPending && (
            <p className="mt-2 text-xs text-stone-400">
              Claude is reading the source code to answer your question...
            </p>
          )}
        </div>
      )}

      {/* Tag filter */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag((current) => (current === tag ? undefined : tag))}
              className={`rounded-full px-2.5 py-1 text-xs ${
                selectedTag === tag
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950"
                  : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Grouped notes */}
      {notesLoading ? (
        <div className="py-12 text-sm text-stone-500">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/70 px-6 py-14 text-center text-stone-500 dark:border-stone-700 dark:bg-stone-950/50 dark:text-stone-400">
          No project notes yet.
        </div>
      ) : (
        <div className="space-y-6">
          {NOTE_TYPE_ORDER.map((type) => {
            const typeNotes = groupedNotes[type];
            if (!typeNotes?.length) return null;
            const { label, icon } = NOTE_TYPE_LABELS[type] ?? {
              label: type,
              icon: "📄",
            };
            return (
              <div key={type}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-stone-400">
                  <span>{icon}</span> {label}
                </h3>
                <div className="space-y-2">
                  {typeNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => router.push(`/projects/${id}/notes/${note.id}`)}
                      className="w-full rounded-[20px] border border-stone-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-950 dark:hover:bg-stone-900"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h2 className="font-medium text-stone-900 dark:text-stone-100">
                            {note.title || "New page"}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">
                            {note.plainText || "Empty note"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-stone-400">
                          {formatDate(note.updatedAt)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/projects/\[id\]/page.tsx
git commit -m "feat: add analysis status, follow-up input, and note grouping to project detail"
```

---

### Task 11: Build verification and lint

- [ ] **Step 1: Run full build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: No lint errors. Fix any that appear.

- [ ] **Step 3: Commit any lint fixes**

```bash
git add -A
git commit -m "fix: lint fixes for source code reading feature"
```

(Skip this commit if no lint fixes were needed.)

---

### Task 12: E2E test — Discover tab and trending

**Files:**
- Modify: `e2e/oss-projects.spec.ts`

- [ ] **Step 1: Add Discover tab E2E tests**

Append to `e2e/oss-projects.spec.ts`:

```typescript
test.describe("Discover tab", () => {
  test("can switch to Discover tab and see trending repos", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Open source projects" })).toBeVisible();

    // Switch to Discover tab
    await page.getByRole("button", { name: "Discover" }).click();

    // Should see trending section
    await expect(page.getByText("Trending")).toBeVisible();

    // Should see time range toggles
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("button", { name: "This Week" })).toBeVisible();
    await expect(page.getByRole("button", { name: "This Month" })).toBeVisible();

    // Should see URL input
    await expect(
      page.getByPlaceholder(/Paste a GitHub repo URL/)
    ).toBeVisible();
  });

  test("can switch between My Projects and Discover tabs", async ({ page }) => {
    await page.goto("/projects");

    // Switch to Discover
    await page.getByRole("button", { name: "Discover" }).click();
    await expect(page.getByText("Trending")).toBeVisible();

    // Switch back to My Projects
    await page.getByRole("button", { name: "My Projects" }).click();
    await expect(page.getByRole("button", { name: "Add project" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: All tests pass (trending data depends on network; tests verify UI structure only).

- [ ] **Step 3: Commit**

```bash
git add e2e/oss-projects.spec.ts
git commit -m "test: add E2E tests for Discover tab and trending UI"
```

---

### Task 13: Final verification and feature commit

- [ ] **Step 1: Full validation**

```bash
pnpm build && pnpm lint && pnpm test:e2e
```

Expected: All three pass.

- [ ] **Step 2: Create changelog entry**

Create `docs/changelog/source-code-reading.md` documenting:
- Feature: GitHub Trending discovery + Claude CLI source analysis + follow-up questioning
- Files added/modified
- Schema changes
- Verification results

- [ ] **Step 3: Commit changelog**

```bash
git add docs/changelog/source-code-reading.md
git commit -m "docs: add changelog for source code reading feature"
```
