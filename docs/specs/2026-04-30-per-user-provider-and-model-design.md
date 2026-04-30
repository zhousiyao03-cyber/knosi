# Design — Per-User Provider & Model Selection (Phase 1.5)

Date: 2026-04-30
Status: Pending written-spec review

## 1. 问题与动机

刚完成的 Phase 1 把 Ask AI 升级成多步 tool-calling agent，但 agent 是否生效取决于 provider mode：

- `local` / `openai` → ✅ tools + 多步循环
- `codex` / `claude-code-daemon` → 降级单轮 RAG

而 `getProviderMode()` 现在**只读 `AI_PROVIDER` env**——意味着部署环境只能选**一个**给所有用户。具体痛点：

1. **Settings 已有 provider selector（`/settings/ai-provider-section.tsx`）但形同虚设**：
   选择会写入 `users.aiProviderPreference`，但 `getProviderMode()` 不读它。只有 hosted Pro vs BYO 的二元决策受影响。用户切到 "OpenAI API"，后端仍按 env 决定走哪条路。
2. **没有 model 选择**：模型 id 全靠 `OPENAI_CHAT_MODEL` 等 env，部署级，不能 per-user。要换模型必须改 .env 重启。
3. **测试新 agent 流程门槛高**：用户截图后想测 tool agent，发现得改 env 重启 dev——但**他对 settings 选择能切 backend 是有合理预期的**。

## 2. 目标与非目标

### 目标

- `getProviderMode(userId?)` **真正读 user preference**，写入即生效，无需重启
- `users` schema 加 `aiChatModel` 列，用户可在 Settings 里选模型（每 provider 一组预置 + "自定义" 输入框）
- Settings UI 在每个 provider 选项下展开 model selector
- `resolveAiSdkModelId(kind, mode, userId?)` 同样接受 userId，先读 user pref 再 fallback env
- 所有调用 `getProviderMode()` / `resolveAiSdkModelId` 的 5 处把 userId 透传
- E2E：切 provider → 验证后端确实走对路径（响应 metadata 带 mode）

### 非目标

- **BYO per-user OpenAI key 存储 / 加密**——独立 Phase 2，仍沿用全局 `OPENAI_API_KEY`
- **Provider auto-detect**（识别 user 所在环境最合适的 provider）——YAGNI
- **Model 对比 / 多模型同时跑**——YAGNI
- **Model selector 的"自定义"输入做服务端校验**（连 `/v1/models` 验证模型是否存在）——MVP 信任用户输入，错了就让 LLM API 报错
- **客户端 Local（WebGPU）模式重构**——那是 `<AskPageLocal>` 完全独立路径，不动
- **daemon 模式纳入 user-pref 路由**——daemon 需要本地 Claude Code 后台进程，不是普通用户切了就能用，保持现有"显式声明"模式

## 3. 方案概述

### 3.1 数据流

```
User 在 /settings 切 provider 或 model
       │
       ▼
trpc.billing.setAiProviderPreference  ┐
trpc.billing.setAiChatModel  (新)     ┼─→ users.{aiProviderPreference, aiChatModel}
                                      ┘
                                      
Ask AI 请求 /api/chat
  ├─ getProviderMode({ userId })  ← 新签名
  │     ├─ 1. 读 users.aiProviderPreference (per-user, 缓存 30s)
  │     ├─ 2. fallback env AI_PROVIDER
  │     └─ 3. fallback auto-detect (现状)
  ├─ resolveAiSdkModelId("chat", mode, { userId })  ← 新签名
  │     ├─ 1. 读 users.aiChatModel
  │     ├─ 2. fallback env OPENAI_CHAT_MODEL / AI_CHAT_MODEL ...
  │     └─ 3. 内置默认（gpt-5.4 / qwen2.5:14b）
  └─ streamChatResponse({...}, { userId })
```

### 3.2 Schema 改动

```ts
// src/server/db/schema/auth.ts
export const users = sqliteTable("users", {
  // ... 现有字段
  aiProviderPreference: text("ai_provider_preference", {
    enum: ["knosi-hosted", "claude-code-daemon", "openai", "local"],
  }),
  aiChatModel: text("ai_chat_model"),  // 新增，自由文本，per-provider 含义不同
});
```

**`aiChatModel` 为什么是自由文本而不是 enum**：每个 provider 的模型列表是开放的（OpenAI 一个月一个新模型，Ollama 用户拉什么模型完全自由）。Settings UI 只是给"推荐列表 + 自定义输入"，DB 不约束。

**迁移**：`pnpm db:generate` → 新增一列 ALTER TABLE。生产 Turso rollout 走 spec §7（参考既有规范）。

### 3.3 Mode 解析新签名

```ts
// src/server/ai/provider/mode.ts
type ProviderModeContext = { userId?: string | null };

export async function getProviderMode(
  ctx: ProviderModeContext = {},
): Promise<AIProviderMode> {
  // 1. user preference
  if (ctx.userId) {
    const pref = await getCachedUserProviderPref(ctx.userId);
    if (pref) {
      // user pref 是 settings UI 那 4 个 enum 之一
      // "knosi-hosted" 实际是 "走 hosted codex 池"——保留现有 shouldRouteHosted 决策路径，
      // 这里返回底层 mode "codex"
      if (pref === "knosi-hosted") return "codex";
      return pref as AIProviderMode;
    }
  }
  // 2/3. env / auto-detect (现有逻辑)
  const explicitMode = process.env.AI_PROVIDER?.trim().toLowerCase();
  // ... 原样
}

const PROVIDER_PREF_CACHE_TTL_MS = 30_000;
const providerPrefCache = new Map<string, { value: string | null; expires: number }>();
const MAX_CACHE = 1000;

async function getCachedUserProviderPref(userId: string) {
  const now = Date.now();
  const cached = providerPrefCache.get(userId);
  if (cached && cached.expires > now) return cached.value;
  const [row] = await db
    .select({ pref: users.aiProviderPreference })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const value = row?.pref ?? null;
  if (providerPrefCache.size >= MAX_CACHE) {
    const oldest = providerPrefCache.keys().next().value;
    if (oldest) providerPrefCache.delete(oldest);
  }
  providerPrefCache.set(userId, { value, expires: now + PROVIDER_PREF_CACHE_TTL_MS });
  return value;
}

export function invalidateProviderPrefCache(userId: string) {
  providerPrefCache.delete(userId);
}
```

`setAiProviderPreference` mutation 里 mutation 后调 `invalidateProviderPrefCache(userId)`，
让用户切完立即生效（不用等 30s）。

### 3.4 Model resolver 新签名

```ts
// src/server/ai/provider/ai-sdk.ts
export async function resolveAiSdkModelId(
  kind: GenerationKind,
  mode: AiSdkMode,
  ctx: { userId?: string | null } = {},
): Promise<string> {
  // 1. user preference (chat only, task 用默认)
  if (kind === "chat" && ctx.userId) {
    const userModel = await getCachedUserChatModel(ctx.userId);
    if (userModel?.trim()) return userModel.trim();
  }
  // 2/3. env / 内置默认 (现有逻辑)
}
```

`task` kind 不用 user model——结构化数据生成对模型一致性敏感（schema 解析），用部署默认更稳。

### 3.5 Settings UI 改造

```tsx
// ai-provider-section.tsx 每个 OPTIONS 行下加一个折叠
<label>
  <input type="radio" ... />
  <div>
    <div>{opt.label}</div>
    <div>{opt.desc}</div>
    {selected === opt.value && (
      <ModelPicker provider={opt.value} />  // 新组件
    )}
  </div>
</label>
```

```tsx
// model-picker.tsx (新)
const PRESET_MODELS: Record<ProviderValue, string[]> = {
  "openai": ["gpt-5.4", "gpt-4o", "gpt-4o-mini", "o1-mini"],
  "knosi-hosted": ["gpt-5.4", "gpt-4o"],
  "claude-code-daemon": ["claude-sonnet-4-6", "claude-opus-4-7"],
  "local": ["qwen2.5:14b", "llama3.2", "mistral-nemo"],
};

function ModelPicker({ provider }) {
  const { data: current } = trpc.billing.getAiChatModel.useQuery();
  const set = trpc.billing.setAiChatModel.useMutation();
  const presets = PRESET_MODELS[provider] ?? [];
  // radio for presets + custom text input
  // "Use deployment default" option (sets to null)
}
```

### 3.6 调用点透传 userId

5 处需改（已 grep 确认）：
1. `src/app/api/chat/route.ts:96` —— 已经有 userId，直接传
2. `src/server/ai/provider/index.ts:81, 126` —— 已经有 user.userId，传进去
3. `src/server/ai/provider/identity.ts:10, 28` —— **没 userId 上下文**，是给 chat-system-prompt 用的"组装 assistant 身份描述"。**保持无 userId**——身份描述用部署默认，避免每次拉 DB
4. `src/server/ai/provider/ai-sdk.ts:104, 150` —— 已经在 `streamChatAiSdk` 内部，从外层传入 ctx
5. **TRPC `billing.setAiProviderPreference`** + 新的 `setAiChatModel` / `getAiChatModel` —— 加 `invalidateProviderPrefCache(userId)`

### 3.7 sync→async 影响

`getProviderMode` 从 sync 变 async。所有调用点要 `await`：
- `route.ts`：本就在 async POST，直接 await
- `provider/index.ts streamChatResponse / generateStructuredData`：本就 async
- `identity.ts getChatAssistantIdentity`：**本来是 sync**，要么改 async（影响 system prompt 构建链）要么**保持原样不读 user pref**——选后者（§3.6 第 3 点理由）

### 3.8 Daemon 路径例外

`shouldUseDaemonForChat()` 仍然只读 `AI_PROVIDER` env（spec §2 非目标）。理由：daemon 需要本地 Claude Code 后台进程才能工作，不是用户在网页选个 radio 就能搭起来。在 settings 里选 "Claude Code Daemon" 但部署没起 daemon → 给用户**前端提示** "AI daemon not set up yet"（截图里那个红框就是现成的）。

route.ts 里 `shouldUseDaemonForChat()` 判断**保持现状**——它和 `getProviderMode()` 是两个独立通道。

## 4. 接口

### 4.1 新增 tRPC

```ts
// src/server/routers/billing.ts
getAiChatModel: protectedProcedure.query(async ({ ctx }) => {
  const userId = (ctx as { userId?: string }).userId;
  if (!userId) return null;
  const [row] = await db
    .select({ model: users.aiChatModel })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.model ?? null;
}),

setAiChatModel: protectedProcedure
  .input(z.object({
    model: z.string().trim().min(1).max(200).nullable(),
  }))
  .mutation(async ({ ctx, input }) => {
    const userId = (ctx as { userId?: string }).userId;
    if (!userId) return { ok: true as const };
    await db
      .update(users)
      .set({ aiChatModel: input.model })
      .where(eq(users.id, userId));
    invalidateModelCache(userId);
    return { ok: true as const };
  }),
```

### 4.2 改签名

```ts
// 旧
getProviderMode(): AIProviderMode
resolveAiSdkModelId(kind, mode): string

// 新
getProviderMode(ctx?: { userId?: string | null }): Promise<AIProviderMode>
resolveAiSdkModelId(kind, mode, ctx?: { userId?: string | null }): Promise<string>
```

`identity.ts` 里继续调用旧风格（不传 ctx）—— mode resolver 默认 ctx={} 会跳过 user pref 分支，等价老行为。

## 5. 错误处理

| 场景 | 行为 |
|---|---|
| user 选了 `openai` 但服务端没 `OPENAI_API_KEY` | `createAiSdkProvider` throws "Missing OPENAI_API_KEY"（现状），前端 toast |
| user 选了 `claude-code-daemon` 但 daemon 没起 | 走 daemon enqueue → poll 找不到 daemon → 现有 banner "AI daemon not set up yet"（截图状态） |
| user 选了 `local` 但 Ollama 没起 | provider 调 `127.0.0.1:11434` connection refused → toast |
| user 自定义 model "gpt-foo-bar" | OpenAI 返回 400 model_not_found → 现有 `getAIErrorMessage` 转译 |
| DB query 失败（极小概率）| `getCachedUserProviderPref` catch → fallback null → env 决策（不 break ask） |

## 6. 测试

### 6.1 单元
- `mode.test.ts`（新）：mock db，验证 user pref > env > auto-detect 三层 fallback
- `mode.test.ts`：缓存 TTL 测试 + invalidate 即时生效
- `ai-sdk.test.ts` 加 case：`resolveAiSdkModelId("chat", "openai", { userId })` 读 user model
- `billing.test.ts` 加 case：setAiChatModel 写入正确 + 长度上限

### 6.2 E2E
- 新 `e2e/per-user-provider.spec.ts`：登录 → settings 切到 OpenAI → 设 model "gpt-4o-mini" → ask → assert 响应 header 或 body 表明 mode=openai + model=gpt-4o-mini
  - **如何 assert mode**：在 `/api/chat` 响应里加 `X-Knosi-Mode` / `X-Knosi-Model` header（debug 用，永久保留无害）

### 6.3 Langfuse
- 现有 `experimental_telemetry.metadata` 已有 `mode`，加 `model`（resolveAiSdkModelId 结果）。一周后能看到 model 分布

## 7. 影响范围

- `src/server/db/schema/auth.ts` — 加 `aiChatModel` 列
- `drizzle/` — 新 migration
- `src/server/ai/provider/mode.ts` — 改 `getProviderMode` 签名 + 加缓存
- `src/server/ai/provider/ai-sdk.ts` — 改 `resolveAiSdkModelId` 签名
- `src/server/ai/provider/index.ts` — await + 透传 userId
- `src/server/ai/provider/identity.ts` — 保持 sync，调用 mode resolver 无 ctx
- `src/server/routers/billing.ts` — 新 trpc + invalidate cache
- `src/app/api/chat/route.ts` — `await getProviderMode({ userId })` + 加 debug header
- `src/app/(app)/settings/ai-provider-section.tsx` — 嵌入 ModelPicker
- `src/app/(app)/settings/model-picker.tsx` — 新组件

**不影响**：
- daemon 链路（`daemon-mode.ts shouldUseDaemonForChat` 保持 env）
- billing entitlements 决策（hosted vs BYO 的 `shouldRouteHosted` 仍然按 user pref，本来就读 db）
- BYO key 存储（Phase 2）

## 8. 排期

| 模块 | 工时 |
|---|---|
| schema + migration + 生产 rollout | 0.5d |
| `getProviderMode` 改 async + 缓存 + 单测 | 0.5d |
| `resolveAiSdkModelId` 改 async + 单测 | 0.3d |
| 5 处调用点 await + 透传 userId | 0.3d |
| 新 trpc `getAiChatModel` / `setAiChatModel` | 0.3d |
| Settings UI ModelPicker + 集成 | 0.8d |
| E2E + debug header | 0.5d |
| Phase changelog + 生产 schema rollout 验证 | 0.3d |
| Buffer | 0.5d |
| **总计** | **~4d** |

## 9. 风险

- **生产 schema rollout**：CLAUDE.md 第 4 条强调要做"明确记录过的 production schema rollout"。这次只是加一列 nullable text，`drizzle-kit push` 风险低。但**rollout 后必须用实际查询验证 `users.ai_chat_model` 列存在**，写入 changelog
- **缓存 stale**：30s TTL + 主动 invalidate。极端场景：用户在多设备同时切，A 设备切完 invalidate 本机缓存但 B 设备进程内缓存还旧——影响小，30s 后自愈
- **`getProviderMode` 变 async 漏改**：tsc 会强制全部改 await，编译期暴露。低风险
- **`identity.ts` 还是 sync 不读 user pref** = chat 系统提示里"我是 X"的 X 永远是部署默认。这是有意妥协，不是 bug。changelog 注明
- **migration 与生产 Turso 的兼容性**：libsql ALTER TABLE ADD COLUMN 是支持的，已知可行
- **回滚**：如果发现严重问题，schema 改动是 additive 的（加列），代码 revert 不会留 schema 不一致

## 10. 后续

- Phase 2：BYO per-user OpenAI key（含加密存储 + UI 输入 + 校验）
- Phase 2：daemon mode 纳入 settings？需要先解决"用户能不能在网页里启 daemon"这个产品问题
- 监控 Langfuse model 分布，3 个月后清理无人用的预设 model
