# 自动 seed 默认 embedding provider — 2026-05-03

## 问题
首次配 AI 的用户只配了 chat / task 的 provider，embedding role 留空，RAG 调用直接抛 `MissingAiRoleError`，结果 Ask AI 走了 keyword-only 检索；更糟糕的情况是用户为图省事把 embedding 也指向 DeepSeek（没有 embedding API），生产环境就会一直打 `[rag] query embedding failed — Not Found`。Embedding 是用户几乎不会主动去想的角色，没有合理默认值不行。

## 修复
新增 `src/server/ai/provider/seed.ts: ensureDefaultEmbeddingProvider(userId)`：

- 检查 `ai_role_assignments` 是否已有 embedding 行 —— 有就直接返回，**绝不覆盖用户已选的 provider**
- 否则建（或复用已有的）transformers provider，模型 `Xenova/multilingual-e5-small`，本地 in-process 跑、零成本、不需要任何 key
- assign 给 embedding role
- `invalidateProviderCache(userId)` 让 resolveAiCall 立即看到新值

挂载点：`aiSettingsRouter.getRoleAssignments` 入口处调一次。用户首次进 `/settings` / `/settings/providers` 即触发；幂等，多次调用不会重复建。

## 文件
- `src/server/ai/provider/seed.ts` — 新增，幂等 seed 函数
- `src/server/ai/provider/seed.test.ts` — 新增 4 个测试：seed / 幂等 / 不覆盖用户配置 / 复用已有 transformers provider
- `src/server/routers/ai-settings.ts` — `getRoleAssignments` 开头调用 seed

## 验证
- `pnpm vitest run src/server/ai/provider/seed.test.ts` ✅ 4 passed
- `pnpm build` ✅
- 改动文件 `pnpm exec eslint` ✅ 零警告
- 部署后用新账号进 settings 验证 embedding 自动出现 Transformers 默认值（待用户确认）

## 给老用户的说明
**对已经手动把 embedding 配成 DeepSeek 的用户，seed 不会触发**（按设计 —— 不覆盖用户选择）。这种用户（包括我自己）需要手动操作一次：

1. Settings → Providers → + Add provider → 选 Transformers → Save
2. AI Roles → Embedding 行切到这个新 provider，Save

之后 `[rag] query embedding failed` 就不会再出现。

## 剩余风险
- Transformers.js 首次跑会下载模型权重（~30MB），第一次 RAG 查询会有几秒冷启动延迟。线上 pod 重启后会重新下载——可以考虑后续把模型 bake 进 docker image。本次不做。
- 如果用户主动删除 transformers provider 而 embedding 仍指向它，`db.delete(aiProviders)` 会被 `onDelete: "restrict"` 拦住，UI 里 deleteProvider 已有提示，没问题。
