# Source Code Reading — 设计文档

## 概述

在现有 `/projects`（开源项目追踪）模块中增加两个能力：

1. **GitHub Trending 推荐 + 手动输入** — 发现感兴趣的项目
2. **AI 源码深度分析 + 交互式追问** — 调用本地 Claude Code CLI 自主阅读仓库源码，生成结构化学习笔记，支持后续追问

目标：让用户在 Second Brain 中完成「发现 → 阅读 → 沉淀」的完整源码学习闭环。

## 用户流程

```
打开 /projects → 切到「发现」Tab
  → 浏览 Trending 列表（今日/本周/本月，可按语言筛选）
  → 或在输入框粘贴任意 GitHub URL
  → 点击「添加并分析」
  → 项目创建，状态显示「分析中...」
  → 后台 Claude Code CLI clone 仓库并自主阅读（几分钟）
  → 完成后生成一篇源码阅读笔记（noteType = analysis）
  → 用户阅读笔记，在追问框输入问题
  → Claude Code 基于同一仓库上下文回答，存为追问笔记（noteType = followup）
  → 所有内容沉淀为项目笔记，可编辑、tag 管理
```

## 数据层变更

### osProjects 表新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `analysisStatus` | text | `null` | `null`（未分析）/ `pending` / `analyzing` / `completed` / `failed` |
| `analysisError` | text | `null` | 失败时的错误信息 |
| `starsCount` | integer | `null` | GitHub star 数 |
| `trendingDate` | text | `null` | 从 trending 添加时的日期（区分来源） |

### osProjectNotes 表新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `noteType` | text | `'manual'` | `manual`（手写）/ `analysis`（AI 初始分析）/ `followup`（追问补充） |

### 不新建表的理由

分析状态挂在 `osProjects` 上，分析结果和追问结果都存为 `osProjectNotes`，完全复用现有 CRUD。按 `noteType` 筛选区分即可。

## 后端服务层

### 文件结构

```
src/server/analysis/
├── trending.ts      # GitHub Trending 抓取 + 缓存
├── github.ts        # GitHub 仓库信息获取
├── analyzer.ts      # Claude CLI 分析调度
└── prompt.ts        # 源码阅读 prompt 模板
```

### trending.ts — Trending 抓取服务

- HTTP GET `https://github.com/trending?since={daily|weekly|monthly}&language={lang}`
- 用 cheerio 解析 HTML，提取：
  - repo 全名（owner/name）
  - 描述
  - 语言
  - star 总数
  - 时间段新增 star 数
- **1 小时内存缓存**（按 since + language 组合做 cache key）
- 返回类型：

```typescript
interface TrendingRepo {
  fullName: string;       // "vercel/ai"
  description: string;
  language: string | null;
  stars: number;
  periodStars: number;    // 今日/本周/本月新增
  url: string;            // "https://github.com/vercel/ai"
}
```

### github.ts — GitHub 仓库信息获取

- 输入：GitHub URL（如 `https://github.com/vercel/next.js`）
- 解析出 `owner/repo`
- 调 GitHub REST API `GET /repos/{owner}/{repo}`（无 token 60 次/小时，有 token 5000 次/小时）
- 返回：名称、描述、语言、star、fork 数
- 可选：配置 `GITHUB_TOKEN` 环境变量提升限额

### analyzer.ts — 分析调度服务

**核心分析流程**：

```typescript
async function analyzeProject(projectId: string, repoUrl: string) {
  // 1. 更新状态
  await updateAnalysisStatus(projectId, 'analyzing');

  // 2. Clone 仓库
  const repoDir = `/tmp/source-readings/${projectId}`;
  await exec(`git clone --depth=1 ${repoUrl} ${repoDir}`);

  // 3. Spawn Claude Code CLI
  const result = await spawnClaude({
    prompt: buildAnalysisPrompt(repoUrl),
    cwd: repoDir,
    allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
  });

  // 4. 存为笔记
  await createAnalysisNote(projectId, result.stdout);

  // 5. 更新状态
  await updateAnalysisStatus(projectId, 'completed');
}
```

**追问流程**：

```typescript
async function askFollowup(projectId: string, question: string, originalAnalysis: string) {
  const repoDir = `/tmp/source-readings/${projectId}`;

  // 如果仓库已被清理，重新 clone
  if (!existsSync(repoDir)) {
    await exec(`git clone --depth=1 ${repoUrl} ${repoDir}`);
  }

  const result = await spawnClaude({
    prompt: buildFollowupPrompt(originalAnalysis, question),
    cwd: repoDir,
    allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
  });

  await createFollowupNote(projectId, question, result.stdout);
}
```

**并发控制**：

- 查询 `analysisStatus = 'analyzing'` 的数量
- 超过 3 个 → 新任务状态设为 `pending`
- 每个任务完成后检查有无 `pending` 任务，按创建时间顺序拉起下一个

**临时目录管理**：

- clone 到 `/tmp/source-readings/{projectId}/`
- 保留 24 小时（供追问使用）
- 超时自动清理（简单的 TTL 检查，在每次分析前执行）

### prompt.ts — Prompt 模板

存放源码阅读 prompt（即 `docs/prompts/source-code-reading.md` 中的 prompt），格式化为 Claude CLI 可用的字符串。包含：

- `buildAnalysisPrompt(repoUrl)` — 初始分析 prompt
- `buildFollowupPrompt(analysis, question)` — 追问 prompt（包含原文 + 问题）

### 新增 tRPC 路由

在 `ossProjectsRouter` 中新增：

| 路由 | 方法 | 输入 | 说明 |
|------|------|------|------|
| `trending` | query | `{ since: 'daily' \| 'weekly' \| 'monthly', language?: string }` | 返回 trending 列表 |
| `fetchRepoInfo` | query | `{ url: string }` | 解析 GitHub URL，返回仓库信息 |
| `startAnalysis` | mutation | `{ projectId: string }` 或 `{ repoUrl: string }`（新建+分析） | 触发分析 |
| `askFollowup` | mutation | `{ projectId: string, question: string }` | 追问 |
| `analysisStatus` | query | `{ projectId: string }` | 查询分析状态（轮询用） |

## 前端

### /projects 页面改造 — 双 Tab

```
┌─────────────────────────────────────────────────┐
│  [我的项目]  [发现]                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  （Tab 内容区）                                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**「我的项目」Tab** — 现有列表，不改动。

**「发现」Tab**：

```
┌─────────────────────────────────────────────────┐
│  🔍 输入 GitHub 仓库 URL...          [分析]     │
├─────────────────────────────────────────────────┤
│  Trending   [今日 | 本周 | 本月]    [语言筛选▾] │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │ vercel/ai  ⭐ 12.3k  +320 today         │   │
│  │ AI SDK for TypeScript                    │   │
│  │ [添加并分析]                [查看 GitHub] │   │
│  ├──────────────────────────────────────────┤   │
│  │ oven-sh/bun  ⭐ 78k  +210 today         │   │
│  │ Fast JavaScript runtime                  │   │
│  │ [添加并分析]                [查看 GitHub] │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

- **输入框**：粘贴 GitHub URL → 调 `fetchRepoInfo` → 展示仓库信息卡片 → 点击「分析」
- **时间范围切换**：今日 / 本周 / 本月，默认今日
- **语言筛选**：下拉选择（All / TypeScript / Rust / Go / Python 等常见语言）
- **已添加项目**：按钮变为状态指示（分析中... / 已完成 ✓）

### /projects/[id] 项目详情页增强

```
┌─────────────────────────────────────────────────┐
│  项目名  ⭐ 12.3k                               │
│  描述...                                        │
│  分析状态：✅ 已完成                             │
├─────────────────────────────────────────────────┤
│  ┌─ 追问框 ──────────────────────────────────┐  │
│  │ 对这个项目有什么想深入了解的？    [发送]   │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  笔记列表（按 noteType 分组显示）               │
│                                                 │
│  📊 源码分析                                    │
│  └─ vercel/ai 源码阅读笔记       2026-04-04    │
│                                                 │
│  💬 追问补充                                    │
│  └─ 关于 streaming 实现细节       2026-04-04    │
│                                                 │
│  ✍️ 手写笔记                                    │
│  └─ 我的理解和 TODO               2026-04-04    │
└─────────────────────────────────────────────────┘
```

- **分析状态区**：显示当前分析状态，analyzing 时显示 spinner
- **追问输入框**：仅在 `analysisStatus = completed` 时出现
- **笔记分组**：按 `noteType` 分三组（源码分析 / 追问补充 / 手写笔记）
- 追问发送后显示 loading，完成后自动刷新笔记列表

### 分析状态轮询

- 触发分析后，前端每 5 秒调 `analysisStatus` 轮询
- 状态流转：`pending`（排队中）→ `analyzing`（分析中...）→ `completed` / `failed`
- `completed` 或 `failed` 时停止轮询
- `completed` 自动刷新笔记列表

## Claude CLI 调用细节

### 初始分析命令

```bash
claude -p "$(cat <<'EOF'
对本目录中的开源项目进行系统性源码阅读...
（完整源码阅读 prompt，见 docs/prompts/source-code-reading.md）
...最终输出一篇 Markdown 文章。
EOF
)" \
  --allowedTools Read,Grep,Glob,Bash \
  --output-format text
```

- 工作目录设为 clone 下来的仓库根目录
- `--allowedTools` 限制为只读工具 + Bash（用于 `wc -l`、`git log` 等）
- 输出纯 markdown 文本

### 追问命令

```bash
claude -p "$(cat <<'EOF'
你之前对这个项目生成了以下源码分析文章：

---
{原始分析文章内容}
---

用户的追问：{question}

请基于项目源码回答这个问题，输出 Markdown 格式。
EOF
)" \
  --allowedTools Read,Grep,Glob,Bash \
  --output-format text
```

### 安全考虑

- Claude CLI 的 `--allowedTools` 不包含 Write/Edit，防止意外修改文件
- clone 使用 `--depth=1` 减少磁盘占用
- `/tmp/source-readings/` 目录 24 小时 TTL 自动清理
- Bash 工具仅用于只读命令（`git log`、`wc`、`find` 等），Claude CLI 自身有沙箱保护

## 不做的事情

- 不做定时自动分析（用户主动选择才分析）
- 不做分析结果的 RAG 向量化（后续可加，但不在本次范围）
- 不做 GitHub 登录/OAuth（用公开 API，无需认证）
- 不改现有「我的项目」Tab 的任何功能
