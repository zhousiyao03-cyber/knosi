# Compact Instructions

当上下文被压缩（compact）后，务必重新阅读 CLAUDE.md 以恢复关键上下文。

## 压缩时保留优先级（从高到低）

1. **架构决策**（绝不摘要，原样保留）
2. **已修改文件及其关键变更**
3. **当前验证状态**（通过/失败）
4. **未完成的 TODO 和回滚说明**
5. **工具输出**（可删除，只保留通过/失败结论）

## 必须恢复的核心规则
1. **先读后写**：修改任何 Next.js 代码前，先读 `node_modules/next/dist/docs/` 中的对应文档。训练数据中的 Next.js API 可能已过时。
2. **自验证三步**：每次修改后必须依次运行 `pnpm build` → `pnpm lint` → `pnpm test:e2e`，不可跳过。
3. **技术备忘**：`.claude/rules/api-pitfalls.md` 包含与训练数据不一致的 API 差异（Vercel AI SDK v6、React 19、Tiptap、E2E），写代码前务必回顾。
4. **Phase 流程**：实现计划在 `PLAN.md`，每个 Phase 完成后需要留档（`docs/changelog/phase-{N}.md`）、E2E 测试通过、commit。
5. **代码规范**：zod v4（`zod/v4`）、`publicProcedure`、`crypto.randomUUID()`、客户端组件 `"use client"`。

## Compact 后的恢复步骤
1. 重新阅读 `CLAUDE.md`（本文件）和 `AGENTS.md`
2. **优先检查 `HANDOFF.md`**，如果存在则以它为主要上下文来源
3. 检查 `PLAN.md` 确认当前所处 Phase
4. 运行 `git log --oneline -5` 了解最近的工作进展
5. 如果有进行中的任务，检查 `docs/changelog/` 最新条目了解上下文
