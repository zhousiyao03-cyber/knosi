# Vercel 部署准备

日期：2026-03-28

## 目标

将 Second Brain 部署到 Vercel，支持多用户 OAuth 认证和数据隔离。

## 完成的功能

- **数据库迁移**：better-sqlite3 → @libsql/client (Turso)，保持 SQLite 方言
- **认证**：Auth.js v5 + GitHub/Google OAuth，JWT session 策略
- **数据隔离**：所有业务表加 userId，tRPC 全部改为 protectedProcedure
- **登录页面**：`/login` 页面，OAuth 登录按钮
- **路由保护**：`src/proxy.ts` 拦截未登录请求
- **AI 速率限制**：每用户每天 50 次 AI 调用（可配置）
- **Token Usage 开关**：线上默认禁用，本地可开启

## 新增/修改文件

### 新增
- `src/lib/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/login/page.tsx`
- `src/proxy.ts`
- `src/app/(app)/layout.tsx`
- `src/server/ai-rate-limit.ts`

### 重要修改
- `src/server/db/index.ts` — libsql 连接
- `src/server/db/schema.ts` — users/accounts/aiUsage 表，业务表加 userId
- `src/server/trpc.ts` — protectedProcedure
- `src/server/routers/*.ts` — 所有 router 改为 protectedProcedure + userId 过滤
- `src/app/api/chat/route.ts` — auth + 限流
- `e2e/global-setup.ts` — test-user seed
- `playwright.config.ts` — AUTH_BYPASS 配置

### 删除
- `src/server/db/path.ts`

## 数据库变更

- 新增表：users, accounts, aiUsage
- 修改表：notes/bookmarks/todos/chatMessages/workflows/learningPaths/tokenUsageEntries 加 userId 字段

## 验证

- `pnpm build`: ✅
- `pnpm lint`: ✅
- `pnpm test:e2e`: ✅ (78 passed, 12 skipped)

## 部署待办（手动步骤）

1. 创建 Turso 数据库并导入本地数据
2. 创建 GitHub / Google OAuth App
3. 推送到 GitHub，连接 Vercel
4. 配置 Vercel 环境变量
5. 首次登录后将现有数据的 userId 归到自己名下
