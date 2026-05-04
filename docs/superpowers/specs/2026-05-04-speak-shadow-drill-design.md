---
date: 2026-05-04
status: draft
topic: speak (shadow drill)
---

# `/speak` — Shadow Drill 模块设计

## 背景与动机

用户痛点：被动词汇量足够（读得懂、听得懂），但**主动产出**（口语 / 写作）时能调用的词汇与表达极小，习惯性回到"中式英语"。这不是"学新词"的问题，是"激活已知词"的问题。

传统 SRS（Anki）训练的是"看到英文 → 想起中文"，方向反了，对这个痛点效果有限。而真正的口语训练需要"在压力下产出 native 表达"。

但用户明确表达了对复杂方案（短语库收集、对话练习、SRS 队列）的拒绝，原话："希望进来之后直接给我 native 的表达，能发出声音，我能跟练"。

因此 v1 聚焦在最低门槛的形态：**打开页面 → 听 native 句子 → 跟读 → 下一句**。

## 产品形态（一句话）

`/speak` 是一个"打开就跟读"的极简口语训练模块。一次显示一句 native 英文，浏览器 TTS 朗读，用户跟读完点 Next 看下一句。无中文、无场景、无录音、无 SRS。

种子库 30 句手挑高质量句子（来源限定为 Reddit/HN 评论、podcast transcript、真人推文），存在仓库 JSON 里。完全随机抽取。每句记录历史累计跟读次数，跨设备同步。

## 范围（v1）

### In scope
- `/speak` 顶层路由，sidebar 入口
- 单页客户端组件，进入后加载并尝试自动播放第一句（iOS 上等首次交互后再播，详见行为规则）
- 30 句手挑种子句子，硬编码在 `src/lib/speak/seed.ts`
- 浏览器 `speechSynthesis` API 朗读，自动选 en-US/en-GB 的 voice
- 完全随机洗牌抽句，全部过完一轮后重新洗牌、不弹完成提示
- 键盘快捷键：`Space` = Play，`→` = Next
- 句子下方显示该句历史累计跟读次数（>0 时显示）
- 入库持久化：`speak_sentence_practice (user_id, sentence_id, count, last_practiced_at)`
- tRPC router: `speak.recordPractice` / `speak.getCounts`

### Explicitly out of scope（v1 不做，已与用户确认）
- 不做录音 / 录音对比
- 不做语速切换 / 慢速播放
- 不显示中文 / 场景注释
- 不做收藏 / 标记不熟
- 不做主题筛选 / 个性化推荐
- 不做"最少练的优先抽"等聪明排序（v1 纯随机）
- 不做进度统计页 / 打卡 / streak
- 不做 AI 生成句子（v1 全部为手挑种子）
- 不做用户提交句子
- 不做 OpenAI / ElevenLabs TTS（v1 浏览器原生 TTS 起步）

## 用户交互

### 页面布局

```
┌─────────────────────────────────────────────────────┐
│  /speak                                              │
│                                                      │
│                                                      │
│       "I'm just gonna ballpark it for now."         │  ← 大字号 (text-3xl 量级)
│                                                      │
│                                                      │
│              [ ▶ Play ]      [ Next → ]             │  ← 两个大按钮
│                                                      │
│                                            Practiced 3 times    │
│                                            12 / 30              │
└─────────────────────────────────────────────────────┘
```

### 行为规则

- **桌面浏览器：进入页面自动播放第一句**
- **iOS Safari：因平台 autoplay 限制，等用户首次 keydown / click 后再播第一句**（不显式提示，让它"看起来像"自动播放）
- `Play` 可重复播放当前句
- `Next` 抽下一句并自动播放
- 键盘：`Space` = Play，`→` = Next
- 全部过完一轮后**重新洗牌、不弹完成提示**，继续往下放
- 切换到下一句时，把"当前句本次 session 听了几次"flush 到后端
- 加 `beforeunload` 保险 flush，避免用户直接关页面丢失计数
- 跟系统的 light/dark mode

### 视觉

- 字号大、上下左右大量留白
- 画面上不放任何其他元素（无统计、无设置、无提示）
- 长句用 `max-w-3xl` + `text-balance` 控制换行
- 只有当前句 `count > 0` 时才显示 `Practiced N times`，避免每句都显示 "0 times" 噪音

## 技术架构

### 文件结构

```
src/app/(app)/speak/
└── page.tsx                          "use client"，整页交互

src/lib/speak/
├── seed.ts                           SEED_SENTENCES（带稳定 ID）
└── tts.ts                            speechSynthesis 封装（voice picker, voice ready await）

src/server/db/schema.ts               + speakSentencePractice 表
src/server/routers/speak.ts           tRPC router
src/server/routers/_app.ts            注册 speak router

src/components/layout/sidebar.tsx     + /speak 入口（lucide Mic 图标）
```

### 数据 Schema

```ts
// src/server/db/schema.ts
export const speakSentencePractice = sqliteTable("speak_sentence_practice", {
  userId: text("user_id").notNull(),
  sentenceId: text("sentence_id").notNull(),
  count: integer("count").notNull().default(0),
  lastPracticedAt: integer("last_practiced_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.sentenceId] }),
}));
```

注：`sentence_id` 是 seed.ts 里硬编码的稳定字符串 ID（如 `"s_001"`），不是数据库自增 PK。改句子文案不会破坏统计。

### tRPC Router

```ts
// src/server/routers/speak.ts
export const speakRouter = router({
  recordPractice: publicProcedure
    .input(z.object({ sentenceId: z.string(), increment: z.number().int().min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      // upsert: count += increment, lastPracticedAt = now
    }),

  getCounts: publicProcedure.query(async ({ ctx }) => {
    // 返回当前 user 的所有 (sentenceId, count) 映射
  }),
});
```

### 种子库

```ts
// src/lib/speak/seed.ts
export type SeedSentence = { id: string; text: string };

export const SEED_SENTENCES: SeedSentence[] = [
  { id: "s_001", text: "I'm just gonna ballpark it for now and we'll refine later." },
  { id: "s_002", text: "Honestly, that's kind of a stretch." },
  // ... 28 more
];
```

ID 用 `s_001` ~ `s_030` 顺序固定 ID。删句子留空号、加句子用新号、不重排。

**选句标准（实施时手挑 30 句，AI 不参与编写）：**
1. 真实 native 口语来源：HN/Reddit 评论、podcast transcript（Lex Fridman / Acquired / The Daily 等）、真人推文
2. 长度 6–18 词
3. 至少包含一个"高频但中国学习者不熟"的表达（如 `ballpark / circle back / a hard sell / sleep on it / good shout`）
4. 避开 slang、profanity、政治话题
5. 优先带情感/态度/口语连接词的（`gotta / kinda / honestly / basically / actually`）
6. 风格定位：working professional 的 casual 口语（已与用户确认）

### 客户端状态管理

- session 内的"洗牌后顺序" + "当前指针" + "当前句在本次 session 内被听了几次（`localPlayCount`）" 全在 React state，刷新即重置
- 进入页面：`useQuery(getCounts)` 拉一次该 user 的累计 count 表，本地缓存以便显示 "Practiced N times"
- session 内点 Play：`localPlayCount += 1`（不打后端，仅 UI 与 flush 用）
- 切到下一句：若当前句的 `localPlayCount > 0`，调 `recordPractice({ sentenceId, increment: localPlayCount })`，然后把累计 count 表本地 +=
- `beforeunload`：同样的 flush 逻辑作为保险（处理用户直接关页面）
- 客户端保证 `increment ≥ 1` 才发请求，server 端 zod schema `min(1)` 是双重防线

### 风险点 & 应对

| 风险 | 应对 |
|---|---|
| `speechSynthesis` 在某些浏览器/系统上声音很差 | `tts.ts` 给一个 voice picker：优先选 en-US/en-GB 的 voice，避免落到默认机器音 |
| iOS Safari 必须用户首次交互才能 `speechSynthesis.speak()` | 进页面不直接 auto-play，延迟到用户首次 keydown/click 后再播第一句。文案不显式提示 |
| 浏览器 TTS voice 列表加载是异步（`onvoiceschanged`） | `tts.ts` 内 await voice ready 后再 speak，避免首句无声 |
| 字体大时长句换行难看 | `max-w-3xl` + `text-balance` |
| 用户狂点 Next 不听就过 | 不阻止。当前句 `localPlayCount === 0` 时跳过 `recordPractice` 调用，不计入 |

## 测试 & 验证

### Playwright E2E (`e2e/speak.spec.ts`)

- 进入 `/speak` → 页面渲染，能看到一句英文 + Play / Next 按钮
- 点 Next 数次 → 句子文本发生变化
- 点 Play 几次后切 Next → 数据库里 `speak_sentence_practice` 对应行 count 累加正确
- 重新进入 `/speak` → 已练过的句子下方显示 `Practiced N times`

不测：TTS 实际发音（headless Chromium 无音频输出，且非核心逻辑）。

### 自验证（CLAUDE.md 要求）

```bash
pnpm db:generate      # 生成 schema migration
pnpm db:push          # 本地应用
pnpm build
pnpm lint
pnpm test:e2e
```

### 生产 Schema Rollout（CLAUDE.md / AGENTS.md 强制）

新增表 `speak_sentence_practice` 影响生产。必须：
1. 在生产 Turso 上执行 `CREATE TABLE` 等价 SQL（按项目 production rollout 流程）
2. 用查询验证表已存在：`SELECT name FROM sqlite_master WHERE type='table' AND name='speak_sentence_practice';`
3. 在 `docs/changelog/` 记录确切的 rollout 命令和验证查询结果
4. handoff 中明确说明 production schema 已同步并验证

不可停在本地 `db:push`。

## Future Work（明确不在 v1）

- 用户自己 append 句子（先尝试 localStorage，再迁库）
- AI 仿照种子风格扩写更多句子
- 按 tag 筛选（工作 / social / 技术讨论 等）
- 接 OpenAI tts-1-hd 做高质量发音 + 预生成 + R2 缓存
- ElevenLabs TTS（最 native，但贵）
- 录音 + 波形/声纹对比
- 慢速播放、按短语分块重复
- "最少练的句子优先抽"的智能调度
- 进度统计 / streak / 打卡

## 决策记录

- **存储位置**：选 DB（Turso）而非 localStorage —— 用户明确要"以后也需要"跨设备同步
- **TTS 选型**：浏览器原生而非云 TTS —— v1 0 成本起步，效果不够再升级
- **句子来源**：v1 全手挑，不用 AI 生成 —— 避免"教科书味"
- **页面状态持久化**：仅次数入库，session 顺序/位置不入库 —— 刷新即重置，符合"打开就练"
- **进度提示**：过完一轮静默重洗 —— 不打断节奏
- **iOS auto-play**：等首次交互再播 —— 平台限制，无法绕开
