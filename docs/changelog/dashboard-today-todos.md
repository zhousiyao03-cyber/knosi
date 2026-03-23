# 2026-03-23 - Dashboard Today Todo List

Task / goal:
- 让首页视图直接显示“今天需要处理的任务”，而不是只显示泛化的待办列表。

Key changes:
- 更新 `src/server/routers/dashboard.ts`，新增 `todayTodos` 查询：
  - 只返回今天到期且未完成的任务。
  - 按截止时间升序展示，方便首页先看最先要处理的事项。
- 更新 `src/app/page.tsx`：
  - 将 Dashboard 第三个区块从“待办事项”调整为“今日任务”。
  - 任务行补充当天时间和“进行中”状态，空态改为提示“今天还没有安排任务”。
  - 保留跳转到 `/todos` 的入口，继续作为完整任务管理页。
- 更新 `e2e/phase6.spec.ts`，新增真实流程验证：首页能显示刚创建的当天任务。

Files touched:
- `src/server/routers/dashboard.ts`
- `src/app/page.tsx`
- `e2e/phase6.spec.ts`
- `docs/changelog/dashboard-today-todos.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; pnpm lint` -> ✅ 通过。
- `source ~/.zshrc >/dev/null 2>&1; pnpm build` -> ✅ 通过；仍有仓库既存的 `next.config.ts -> src/server/db/path.ts` NFT tracing warning，但构建成功。
- `source ~/.zshrc >/dev/null 2>&1; pnpm exec playwright test e2e/phase6.spec.ts --reporter=line` -> ⚠️ 未完成；Playwright 配置固定在 `3100` 端口启动隔离 dev server，但当前仓库已有用户自己的 `next dev` 进程在跑，Next 检测到同目录 dev server 后拒绝再次启动。
- `source ~/.zshrc >/dev/null 2>&1; node --input-type=module <<'EOF' ... EOF` -> ✅ 通过；使用 Playwright Chromium 直连现有 `http://127.0.0.1:3000`，真实创建当天 Todo `home-today-0ni96h` 后返回首页，确认它出现在“今日任务”区块。

Remaining risks / follow-up:
- 当前首页只显示“今天到期”的任务，不包含逾期任务；如果你希望首页同时承接“今天 + 逾期”的执行视图，还可以再补一个优先级策略。
- `todayTodos` 依赖服务端本地时区判断“今天”，如果后续需要多时区使用场景，需要把用户时区显式纳入查询口径。
