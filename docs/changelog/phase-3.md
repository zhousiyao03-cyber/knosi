# Phase 3：Todo + 收藏箱模块

**完成日期**：2026-03-21

## 完成的功能

### Todo 模块
1. 创建任务（标题 + 优先级选择）
2. 状态循环切换（待办 → 进行中 → 已完成 → 待办）
3. 优先级标签（低/中/高，颜色区分）
4. 按状态/优先级筛选
5. 删除任务
6. 已完成任务显示删除线和半透明效果

### 收藏箱模块
1. 添加 URL 收藏（标题 + URL）
2. 添加纯文本收藏（仅标题）
3. 收藏列表展示（来源标签、时间、摘要预览）
4. 删除收藏
5. 表单展开/收起交互

## 新增/修改的文件

- `src/app/todos/page.tsx` — Todo 列表页（重写）
- `src/app/bookmarks/page.tsx` — 收藏箱列表页（重写）
- `e2e/phase3.spec.ts` — 11 个测试用例

## 数据库变更

无

## 验证结果

- `pnpm build` ✅ 编译通过
- `pnpm lint` ✅ 无 ESLint 错误
- `pnpm test:e2e` ✅ 32/32 通过（Phase 1: 11 + Phase 2: 10 + Phase 3: 11）

## 已知问题

- Todo 暂无拖拽排序功能（计划后续优化）
- 收藏箱暂无 URL 自动抓取内容功能（Phase 4 AI 集成时实现）

---

## 2026-03-21 - Todo 可用性优化

Task / goal:
- 将 Todo 模块从“仅能快速记录标题”提升到“可用于日常管理”，补齐时间、编辑和按时间组织任务的核心体验。

Key changes:
- 新增可展开的创建表单，支持截止时间、分类、描述和优先级输入。
- Todo 列表改为按 `逾期 / 今天 / 即将到来 / 无时间 / 已完成` 分组展示，并补充更清晰的时间语义。
- 新增右侧详情编辑面板，支持原地修改标题、描述、分类、状态、优先级和截止时间。
- 支持清空截止时间，修复将 `null` 截止时间错误写成 Unix 起始时间的问题。
- 更新 Phase 3 的 Todo E2E，用真实交互覆盖创建、编辑、清空时间、筛选和删除流程。

Files touched:
- `src/app/todos/page.tsx`
- `src/server/routers/todos.ts`
- `e2e/phase3.spec.ts`

Verification commands and results:
- `pnpm build` -> ✅ 通过（在本地执行 `pnpm rebuild better-sqlite3` 后恢复构建能力）。
- `pnpm lint` -> ✅ 通过，但仓库中仍有 1 个既存 warning：`src/components/editor/slash-command.tsx` 的无效 eslint-disable。
- `pnpm exec playwright test --grep "Phase 3: Todo 模块"` -> ✅ 7/7 通过。
- `pnpm exec playwright test` -> ❌ 存量失败仍在 `e2e/phase2.spec.ts`，原因是笔记模块测试仍在断言旧版编辑器 UI（与本次 Todo 改动无关）。

Remaining risks / follow-up:
- Todo 仍未实现拖拽排序和提醒通知。
- 全量 E2E 需要等笔记编辑器改造稳定后同步更新 `phase2` 测试。

## 2026-03-22 - Todo 视觉改版

Task / goal:
- 提升 Todo 模块的视觉质感和信息层级，让页面更像日常常用工具，而不是基础后台表单页。

Key changes:
- 重做 Todo 页头部，加入更明确的视觉重心、渐变氛围和统计卡片层级。
- 将录入区、筛选区、任务分组卡片和详情面板统一为更有节奏的圆角卡片体系。
- 为不同任务分组加入差异化的配色、图标和说明文案，减少大面积“同一张白卡”的单调感。
- 优化任务项样式，增强主标题、状态、优先级和时间标签的可读性。
- 将任务分类输入改为受控 `select`，避免自由输入导致分类体系越来越散。
- 将时间录入改为“快捷日期 + 日期 / 时段分开选”，替代难用的 `datetime-local`。
- 默认折叠超长的 `无时间` / `已完成` 分组，并在快速录入后自动展开定位到新任务，减少“任务没出来”和“页面过长”的体感问题。
- 保持原有核心交互和测试标签名不变，确保视觉升级不影响使用与自动化验证。

Files touched:
- `src/app/todos/page.tsx`
- `e2e/phase3.spec.ts`
- `docs/changelog/phase-3.md`

Verification commands and results:
- `pnpm build` -> ✅ 通过。
- `pnpm lint` -> ✅ 通过，但仓库中仍有 1 个既存 warning：`src/components/editor/slash-command.tsx` 的无效 eslint-disable。
- `pnpm exec playwright test --grep "Phase 3: Todo 模块"` -> ✅ 7/7 通过。
- `PLAYWRIGHT_HTML_OPEN=never pnpm exec playwright test --reporter=line` -> ✅ 66/66 通过（2026-03-22，合并笔记编辑器新测试并修复学习模块 flaky 用例后复验）。

Remaining risks / follow-up:
- 当前视觉优化集中在 Todo 页面，其他页面的设计语言还比较朴素，后续如果继续统一界面风格，可能需要一起收口。
- Todo 仍未实现提醒通知或拖拽排序等更重度的任务管理能力。
