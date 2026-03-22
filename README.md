# Second Brain

个人 AI 知识管理平台。把信息（笔记、URL、文本片段）存进来，AI 自动理解，随时搜索和问答。

## 功能（V1）

- **笔记** — Tiptap 富文本编辑器，自动保存，类型/标签管理
- **收藏** — URL 收藏自动抓取正文（Readability），AI 生成摘要和标签
- **搜索** — Cmd+K 全局搜索笔记、收藏、待办，关键词高亮
- **Ask AI** — 基于知识库的 RAG 问答，引用来源可点击跳转
- **Dashboard** — 统计概览 + 最近条目
- **暗色模式** — 全局可切换

冻结模块（保留但不活跃开发）：Todo、AI 探索

## 技术栈

- Next.js 15 (App Router) + React 19
- Tailwind CSS v4
- tRPC v11 + Zod v4
- Drizzle ORM + SQLite (better-sqlite3)
- Vercel AI SDK v6 + Claude API
- @mozilla/readability + linkedom
- Playwright (E2E)

## 快速开始

```bash
pnpm install
pnpm db:push       # 初始化数据库
pnpm dev            # 启动开发服务器 http://localhost:3000
```

需要配置环境变量：

```bash
# .env.local
ANTHROPIC_API_KEY=your-api-key
```

## 常用命令

```bash
pnpm dev            # 开发服务器
pnpm build          # 生产构建（含 TypeScript 检查）
pnpm lint           # ESLint 检查
pnpm test:e2e       # E2E 测试
pnpm db:generate    # 生成数据库迁移
pnpm db:push        # 应用迁移到数据库
pnpm db:studio      # Drizzle Studio
```

## 项目结构

```
src/
  app/              Next.js App Router 页面和 API 路由
  components/       UI 和布局组件（toast、search-dialog、editor）
  lib/              客户端工具函数和 tRPC client
  server/
    db/             数据库连接和 schema
    routers/        tRPC routers
    ai/             AI 相关逻辑（RAG、URL 内容抓取）
e2e/                Playwright E2E 测试
docs/
  v1-plan.md        V1 收敛执行计划
  changelog/        变更记录
```

## V1 收敛进度

- [x] Pass 1: 产品收敛（隐藏 Workflows/Learn）
- [x] Pass 2: Bookmark 内容抓取 + AI 摘要修复
- [x] Pass 3: Ask AI RAG 实现
- [x] Pass 4: Search 增强 + API 加固
- [x] Pass 5: UX/UI 打磨 + 暗色模式
- [x] Pass 6: E2E 收尾 + 工程文档收口

详见 `docs/v1-plan.md` 和 `docs/changelog/v1-convergence.md`。
