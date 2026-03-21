# Phase 6：完善与优化

**完成日期**：2026-03-21

## 完成的功能

### 首页仪表盘
1. 笔记/收藏/待办/学习路径统计卡片
2. 最近笔记列表（可点击跳转编辑）
3. 最近收藏列表
4. 待办事项快览（显示优先级标签）
5. 各区块「查看全部」快捷链接

### 全局搜索（Cmd+K）
1. `Cmd+K` / `Ctrl+K` 快捷键唤起搜索面板
2. `ESC` 关闭
3. 实时搜索笔记、收藏、待办（tRPC LIKE 查询）
4. 搜索结果分类显示（图标+类型标签）
5. 点击结果跳转对应页面
6. 键盘快捷键提示

### 深色模式
1. 侧边栏底部切换按钮
2. localStorage 持久化主题偏好
3. Tailwind v4 `@custom-variant dark` 实现
4. 侧边栏完整深色适配

## 新增/修改的文件

- `src/server/routers/dashboard.ts` — Dashboard 统计 + 搜索 tRPC router
- `src/server/routers/_app.ts` — 注册 dashboard router
- `src/app/page.tsx` — 首页仪表盘（重写）
- `src/app/layout.tsx` — 添加 SearchDialog + 深色模式 class
- `src/app/globals.css` — dark variant 配置
- `src/components/search-dialog.tsx` — Cmd+K 搜索面板
- `src/components/layout/sidebar.tsx` — 深色模式切换 + dark 样式
- `e2e/phase6.spec.ts` — 12 个测试用例

## 验证结果

- `pnpm build` ✅ 编译通过
- `pnpm lint` ✅ 无 ESLint 错误
- `pnpm test:e2e` ✅ 65/65 通过（Phase 1-5: 53 + Phase 6: 12）

## 已知问题

- 深色模式仅适配了侧边栏和主内容区，各子页面内容未做细粒度深色适配
- 飞书文档 MCP 对接未实现（需要外部服务配合）
- 数据导出功能未实现（可后续添加）
