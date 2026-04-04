# Source Code Reading Feature

**Date:** 2026-04-04

## Summary

在现有 `/projects` 模块中增加了 GitHub Trending 发现 + Claude CLI 源码深度分析 + 交互式追问功能。

## Key Changes

### Schema
- `osProjects` 新增 `analysisStatus`, `analysisError`, `starsCount`, `trendingDate` 字段
- `osProjectNotes` 新增 `noteType` 字段（manual/analysis/followup）

### Backend Services (`src/server/analysis/`)
- `trending.ts` — GitHub Trending 页面抓取 + 1 小时内存缓存
- `github.ts` — GitHub REST API 仓库信息获取
- `prompt.ts` — 源码分析和追问的 prompt 模板
- `analyzer.ts` — Claude CLI 调度引擎，支持并发控制（max 3）、自动排队、24h 临时目录清理

### tRPC Routes (added to `oss-projects.ts`)
- `trending` — 获取 trending 列表（daily/weekly/monthly + 语言筛选）
- `fetchRepoInfo` — 解析 GitHub URL 获取仓库信息
- `startAnalysis` — 触发源码分析（自动创建项目 + spawn Claude CLI）
- `analysisStatus` — 查询分析状态（前端轮询用）
- `askFollowup` — 追问（spawn Claude CLI 基于仓库上下文回答）

### Frontend
- `/projects` 页面改为双 Tab 布局（My Projects / Discover）
- Discover Tab：URL 输入框 + Trending 列表（时间范围切换 + 语言筛选）
- 项目详情页：分析状态显示、追问输入框、笔记按 noteType 分组展示

## Files Added
- `src/server/analysis/trending.ts`
- `src/server/analysis/github.ts`
- `src/server/analysis/prompt.ts`
- `src/server/analysis/analyzer.ts`
- `src/app/(app)/projects/discover-tab.tsx`

## Files Modified
- `src/server/db/schema.ts`
- `src/server/routers/oss-projects.ts`
- `src/app/(app)/projects/page.tsx`
- `src/app/(app)/projects/[id]/page.tsx`
- `e2e/oss-projects.spec.ts`

## Verification
- `pnpm build`: ✅ Pass
- `pnpm lint`: ✅ No issues in new files (pre-existing lint errors in toc-sidebar.tsx unchanged)
- E2E tests: Added Discover tab tests
