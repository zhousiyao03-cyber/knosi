---
date: 2026-05-04
status: draft
topic: words (pronunciation drill)
---

# `/words` — Pronunciation & Vocab Drill 模块设计

## 背景与动机

`/speak` 解决了"句子级跟读"这一层。但用户在使用中发现一个新痛点（与 `/speak` 互补）：

- **B：单词层面的发音不准** — 知道大概怎么读，但重音位置错（`PHO-to-graph` vs `pho-TO-graph`）、元音错、连读不会
- **D：很多单词不认识** — 是真正的盲点，光听不知道意思就进不了主动词汇库

`/speak` 处理的是"句子里所有词放在一起的发音节奏"，无法专门服务这两类痛点。需要一个**单词级**的训练界面，把"听音 + 重音可视化 + 中文释义 + 在真实例句里听一次"四件事捆在一张卡上。

## 产品形态（一句话）

`/words` 是"打开就跟读单词"的极简发音/熟练度训练模块。一次显示一个单词及其结构信息（重音可视化 / IPA / 中文释义 / 一个 native 例句），浏览器 TTS 单独朗读单词或例句，用户跟读，按 Next 下一个。

种子库 100 词手挑（开发期 AI 一次性 enrich 4 字段，人工 review 后写进 `seed.ts`）；用户也可以单条 append 自己的生词，实时调 AI 补全 4 字段并落库。

## 范围（v1）

### In scope

- `/words` 顶层路由，sidebar LEARN 段落入口（`BookOpen` icon）
- 单页客户端组件，进入后随机抽一词、自动播放（受 iOS 首交互 gate 限制）
- 100 词 hand-picked 种子，硬编码在 `src/lib/words/seed.ts`，含 `id, text, ipa, stressPattern, meaningZh, exampleEn`
- 用户单条 append 输入（modal），调 AI 实时 enrich 4 字段、落库
- 卡片显示：重音可视化（大字）→ IPA → 中文释义 → 例句
- 三个按钮：`▶ Word` / `▶ Sentence` / `Next →`
- 键盘：`Space` = Word，`S` = Sentence，`→` = Next
- 完全随机洗牌抽词；过完一轮静默重洗
- 句子下方显示该词历史累计跟读次数（>0 时显示）
- 持久化：`user_words` + `word_practice` 两张表，FK 到 `users` ON DELETE CASCADE
- tRPC：`addWord`（`proProcedure`，调 AI）、`listWords`、`recordPractice`、`getCounts`（后三者 `protectedProcedure`）
- AI 用项目现有 `src/server/ai/provider/index.ts` 抽象 + `generateStructuredData`
- E2E mock：通过 `WORDS_E2E_MOCK=1` 走 fake enrichment，避免 e2e 烧 token
- 沿用 `/speak` 的 `tts.ts` 和 `shuffle.ts`

### Explicitly out of scope（v1 不做）

- 录音 / 录音对比（v2 起再考虑）
- SRS / 复习算法 / 间隔重复
- "标记不熟" / "标记已掌握"
- 慢速 / 按音节分块重复
- 粘贴英文段落自动提词
- 主题筛选 / 个性化推荐
- 进度统计 / streak / 打卡
- 公开词表 import（NGSL/Oxford 3000 等不接）
- 用户编辑已有词的 enrichment

## 用户交互

### 页面布局

```
┌──────────────────────────────────────────────────────┐
│  /words                                               │
│                                                       │
│              e·PIT·o·me                              │  ← 重音可视化 (text-4xl)
│              /ɪˈpɪt.ə.mi/                            │  ← IPA (text-base mono)
│              典型；缩影                                  │  ← zh meaning
│                                                       │
│   "He is the epitome of professionalism."           │  ← native 例句
│                                                       │
│   [ ▶ Word ]  [ ▶ Sentence ]  [ Next → ]            │
│                                                       │
│   [ + Add word ]                       Practiced 5 ×  │
│                                              12 / 100 │
└──────────────────────────────────────────────────────┘
```

### 行为规则

- **桌面**：进页面尝试自动播 Word 一次
- **iOS Safari**：等首次交互后再播（沿用 `/speak` 的 `useSyncExternalStore` + gestureReceived 模式）
- `▶ Word` / `▶ Sentence` 可重复按
- `Next` 切下一个词，自动播 Word 一次
- 全部过完一轮静默重洗
- 切到下一词时 flush 当前词的 session play count（同 `/speak`）
- `+ Add word` 打开 modal：单词输入 → Save → 显示 loading（AI enrich 中）→ 完成后这个词进入当前 session 库 + 落库；下一次进 `/words` 也会出现
- 已经 own 的词（user_id, text_normalized 唯一）重复 add 直接报错"already in your list"
- 失败时 modal 显示 error，不入库

### 视觉

- 重音可视化字号最大；其他三行依次缩小
- 例句斜体 / 引号 / 上下留白
- 跟系统 light/dark mode
- modal 简洁：一个 input、Save 按钮、错误文案

## 技术架构

### 文件结构

```
src/app/(app)/words/
└── page.tsx                          "use client"，整页 + Add modal

src/lib/words/
└── seed.ts                           SEED_WORDS: SeedWord[] (100 entries)

(复用)
src/lib/speak/shuffle.ts
src/lib/speak/tts.ts                  无差别复用，无需新增 wrapper

src/server/db/schema/words.ts         user_words + word_practice
src/server/db/schema/index.ts         + export * from "./words"
src/server/routers/words.ts           addWord / listWords / recordPractice / getCounts
src/server/routers/_app.ts            注册 wordsRouter

src/server/ai/words.ts                enrichWord(text) -> Promise<Enrichment>

src/components/layout/navigation.ts   + /words 入口（BookOpen icon）
scripts/db/apply-2026-05-04-words-rollout.mjs   生产 schema rollout
scripts/words/generate-seed-enrichment.mjs       开发期一次性 AI 预生成

e2e/words.spec.ts                     Playwright e2e
docs/changelog/2026-05-04-words-phase-1.md
```

### 数据 Schema

```ts
// src/server/db/schema/words.ts

export const userWords = sqliteTable(
  "user_words",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),                  // nanoid, e.g. "uw_a3kfPq..."
    text: text("text").notNull(),                       // "epitome"
    textNormalized: text("text_normalized").notNull(),  // lowercased, trimmed
    ipa: text("ipa").notNull(),
    stressPattern: text("stress_pattern").notNull(),
    meaningZh: text("meaning_zh").notNull(),
    exampleEn: text("example_en").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.wordId] }),
    uniqByText: uniqueIndex("user_words_user_text_idx").on(t.userId, t.textNormalized),
  })
);

export const wordPractice = sqliteTable(
  "word_practice",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),                  // seed: "w_001"…; user: userWords.wordId
    count: integer("count").notNull().default(0),
    lastPracticedAt: integer("last_practiced_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.wordId] }),
  })
);
```

注：`word_practice` 不对 `word_id` 做 FK —— 因为它要同时容纳种子词（seed.ts 里的稳定 ID，库里没有对应行）和用户词（`user_words.word_id`）。这跟 `/speak` 的 `speak_sentence_practice` 同款设计。

### tRPC Router

```ts
// src/server/routers/words.ts
export const wordsRouter = router({
  // Pro-gated: AI enrichment costs tokens.
  addWord: proProcedure
    .input(z.object({ text: z.string().trim().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      const normalized = input.text.toLowerCase();
      // dedupe check
      const existing = await db
        .select({ wordId: userWords.wordId })
        .from(userWords)
        .where(and(eq(userWords.userId, ctx.userId), eq(userWords.textNormalized, normalized)))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Already in your list" });
      }
      // AI enrich (or mock when WORDS_E2E_MOCK=1)
      const enrichment = await enrichWord(input.text);
      const wordId = `uw_${nanoid()}`;
      await db.insert(userWords).values({
        userId: ctx.userId,
        wordId,
        text: input.text,
        textNormalized: normalized,
        ...enrichment,
        createdAt: Date.now(),
      });
      return { wordId, ...enrichment };
    }),

  listWords: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(userWords)
      .where(eq(userWords.userId, ctx.userId))
      .orderBy(desc(userWords.createdAt));
    return rows;  // shape consumed by client
  }),

  recordPractice: protectedProcedure
    .input(z.object({
      wordId: z.string().regex(/^(w_\d{3}|uw_[A-Za-z0-9_-]+)$/),
      increment: z.number().int().min(1).max(50),
    }))
    .mutation(async ({ input, ctx }) => {
      // UPSERT same as /speak
    }),

  getCounts: protectedProcedure.query(async ({ ctx }) => {
    // returns Record<wordId, count>
  }),
});
```

### AI Enrichment

```ts
// src/server/ai/words.ts
const enrichmentSchema = z.object({
  ipa: z.string().min(1),
  stressPattern: z.string().min(1),  // e.g. "e·PIT·o·me"
  meaningZh: z.string().min(1).max(40),
  exampleEn: z.string().min(1).max(200),
});

export async function enrichWord(text: string): Promise<EnrichmentOutput> {
  if (process.env.WORDS_E2E_MOCK === "1") {
    return {
      ipa: "/test/",
      stressPattern: text.toUpperCase(),
      meaningZh: "测试",
      exampleEn: `This is a test example with ${text}.`,
    };
  }
  return generateStructuredData({
    schema: enrichmentSchema,
    system: "...",  // 见下 prompt
    prompt: `Enrich this English word for a Chinese learner: ${text}`,
  });
}
```

**Prompt 设计要点：**
- 要求 IPA 用 `/.../` 格式
- 要求 `stressPattern` 用 dot 分音节、ALL-CAPS 标重音（例如 `e·PIT·o·me`），单音节词全大写（`HOUSE`）
- `meaningZh` 限制 ≤ 12 字，最常见义项一条，不列多条
- `exampleEn` 限制 6-18 词、native casual 风格、必须包含原词的某个屈折形式
- 输出风格匹配 `/speak` 的种子句子审美（不要 textbook 味）

### 客户端状态管理

- 进入页面：`useQuery(listWords)` + `useQuery(getCounts)` 并发
- 合并：`allWords = [...SEED_WORDS, ...listWords.data]`，shuffle 一次得到 session 顺序
- session 内点 Play / Sentence：`localPlayCountRef += 1`
- 切下一词时 `recordPractice.mutate({ wordId, increment: localPlayCountRef })`，同 `/speak`
- `beforeunload` 保险 flush
- Add modal：`addWord.mutateAsync`，成功后：
  - 把新词 push 进当前 session 库尾部（不打乱当前位置）
  - `utils.words.listWords.invalidate()`
  - `utils.words.getCounts.invalidate()` 不必（新词 count=0）
  - 关 modal

### 风险点 & 应对

| 风险 | 应对 |
|---|---|
| AI 生成的 IPA / stress 格式不一致 | zod schema 严格校验 + prompt few-shot 例子 |
| 用户加词时 AI 调用失败 | mutation 抛错；modal 显示 error；不落库 |
| 用户重复加同一词 | client 端先 trim+lowercase 去 dedupe；server 端 unique index 兜底 |
| 例句 TTS 太长 | `exampleEn` 在 zod 限 200 字符 |
| 例句中包含原词的形态变化 | prompt 要求出现，但不强制 —— "Practiced 这个词时听到的 practiced 是 native 自然形式" 是好事 |
| Chrome 老版本不支持 `BookOpen` 图标 | lucide 早就支持了 |
| 100 词种子审美不齐 | 我手挑词 → AI enrich → 我 review → 落 seed.ts，不直接信任 AI 输出 |

## 测试 & 验证

### Playwright E2E (`e2e/words.spec.ts`)

- 进入 `/words` → 看到一词 + 三按钮
- 点 Next → 词变化
- 点 Word 几次 + Next → `word_practice` 累加正确
- 重新进入 → "Practiced N times" 正确显示
- Add word 流程（用 `WORDS_E2E_MOCK=1` mock AI）：
  - 打开 modal → 输入 "testword" → Save
  - 看到 success
  - 翻翻 deck 应该能找到 "testword" 出现
  - 重复 add 同一词 → 看到 "Already in your list"

### 自验证（CLAUDE.md 三步）

```bash
pnpm db:generate
pnpm db:push
pnpm build
pnpm lint        # 清 .next-e2e 缓存后再跑
pnpm test:e2e e2e/words.spec.ts
```

### 生产 Schema Rollout（强制）

`scripts/db/apply-2026-05-04-words-rollout.mjs`：
- 创建 `user_words`（含 unique index）
- 创建 `word_practice`
- 验证两个表存在 + FK on_delete = CASCADE + composite PK + unique index 存在
- 输出 `✅ Production rollout verified`

## Future Work（明确不在 v1）

- 录音 + 波形对比
- SRS 调度（下次复习时间 / 间隔）
- "最少练的优先抽" / "刚加的优先抽"
- 慢速播放、音节切片
- 粘贴段落自动提词
- 用户编辑已有 enrichment（修正 AI 错的释义/例句）
- 接 OpenAI tts-1-hd 提升发音质量
- 词性标注、近义词
- 跨用户共享词库（社区词包）

## 决策记录

- **种子来源**：100 词 hand-picked，AI 仅做 enrichment（不让 AI 选词）—— 避免"教科书味"
- **AI 用法**：开发期 + 用户加词时各调一次，运行时跟读不调 —— 成本可控、确定性高
- **Pro gating**：`addWord` 用 `proProcedure`（hosted 收费、self-hosted 自动 PRO_UNLIMITED），与项目其他 AI 功能一致
- **去重策略**：（user_id, text_normalized）unique index，client 先做去重 UX 提示
- **schema FK**：`word_practice.word_id` 不做 FK，要兼容种子词
- **中文释义**：单词模块给中文（解决"不认识"），与 `/speak` 不给中文形成互补 —— 不同模块解决不同问题
- **TTS 仍用浏览器原生**：沿用 `/speak` 的 voice picker（已偏好 Premium/Enhanced/Neural）
- **不做录音**：v1 工程量限制，与 `/speak` 一致
- **键盘 S 而非 Space**：Space 已绑 Word；例句单独绑 S 避免冲突
