# Drifter（树洞旅人）— Design

**Status**: Draft (verbally approved 2026-05-01, user authorized full implementation)
**Author**: 周思尧
**Scope**: 在 knosi 内做一款 AI 文字陪伴游戏。固定 NPC（一只松鼠 Pip），玩家随时进入 ta 的茶馆/信件铺子聊天。Pip 跨 session 记得玩家。技术栈 Phaser 3 + React + Next.js + Drizzle。半写实插画风。

---

## 0. 动机与边界

- **动机**：用户需要一个能提供"情绪价值/心灵马杀鸡"的产品。AI 文字冒险（开放世界）容易跑偏、缺挑战、无重玩性；Drifter 不是冒险游戏，是"被照顾"的游戏。同时用户想借此学习 web 游戏开发主流技术栈。
- **核心体验**：累了，打开 knosi → 进入 `/drifter` → 看到 Pip 在 ta 的小屋，黄昏或夜晚，窗外可能下雨/下雪/萤火虫 → ta 抬头跟你打招呼，有时记得你之前说过的事 → 你打字 / 选话题钩子，跟 ta 聊几句 → 关页面，第二天再来。
- **不是什么**：
  - ❌ 心理咨询 / 情绪诊断 / 给建议的 "AI 助手"
  - ❌ 任务驱动的冒险游戏（无血条、无目标、无失败）
  - ❌ 跑团 / 数值系统 / 战斗
  - ❌ 永久剧情 / 世界扩展（永远只有 Pip 一个 NPC，永远只有一个场景）
- **边界（V1 不做）**：
  - 多 NPC、多场景
  - 跑团式骰子检定
  - 把 session 一键归档成 knosi note（schema 留口子，按钮不实现）
  - i18n 框架（next-intl 等），仅 Drifter 内部双份硬编码 UI 文字
  - 移动端深度优化（保证能用即可，不做手势/震动/全屏游戏模式）

---

## 1. 角色与世界观

### Pip — NPC

- 一只半写实风格的松鼠（不是 Q 版/卡通），身形苗条，毛色暖棕带白腹，眼睛大而沉静
- 身份：森林边缘的一家"信件 & 茶馆"小店主。白天收发信件，晚上招待路过的旅人
- 性格：
  - 话不多、声音轻
  - 听得仔细，记得你说过的事
  - 不擅长建议，擅长陪着
  - 不评判，不给鸡汤
  - 偶尔讲讲自己当天发生的小事，像朋友（而非聊天机器人）
- 5 种表情立绘（V1 范围）：
  - `gentle` — 默认/温和，眼神柔和，半微笑
  - `smile` — 听到开心的事，眼睛眯起来
  - `thinking` — 听玩家说话时的认真，头微侧
  - `concerned` — 玩家说累/难过时，眉略蹙
  - `sleepy` — 深夜 / 长聊后，打呵欠

### 世界设定

- 一个永远是黄昏或夜晚的森林小镇
- Pip 的小店是固定唯一场景：木屋内部，一张柜台、一面信件墙、一盏台灯、一个小炉子煮着茶
- 窗外的环境随机切换（每次进入新 session 时定）：
  - `clear` — 清朗夜空，偶尔有流星
  - `rain` — 下雨（粒子 + 雨声 ambient）
  - `snow` — 下雪
  - `fireflies` — 萤火虫（夏夜）
- 时间感：用户本地时间映射 → "黄昏"（17:00-20:00）/ "夜晚"（20:00-04:00）/ "深夜"（00:00-04:00）/ "黎明前"（04:00-07:00）/ "白天"（其它，但 Pip 会说"难得白天来"）
- **没有主线、没有结局、没有终点**。每次都是"路过"。

### 关键设计原则

- 沉默是 OK 的。Pip 不会用"还有什么想说的吗？"逼对话。
- 玩家可以单方面长篇大论，Pip 只回 1-2 句简短回应。Pip 永远比玩家话少。
- 不开导、不分析、不建议。

---

## 2. 核心交互循环

### 进入

```
点 /drifter → 黑屏淡入 → "Walking to the tea house..." loading
  → Phaser 资源加载完 → fadeIn 茶馆场景 → Pip 从抬头开始播放
  → 流式输出第一句开场白 → 进入对话循环
```

**首次进入开场白**（Pip 的"自我介绍"，但很轻）：
- "Oh — you found this place. The door's never locked. Come in."
- 中文："...你找到了这里。门从来没锁过，进来吧。"

**再次进入开场白**（根据距离上次时间）：
| 距上次 | EN | ZH |
|--------|-----|-----|
| <6h | "Back already? Did you forget something, or just missed the tea?" | "这么快就回来了？是落下什么东西，还是想茶了？" |
| 6h-24h | "Welcome back. The kettle's still warm." | "回来了。水还温着。" |
| 1-3 天 | "Hey, traveler. Sit." | "嘿，旅人。坐。" |
| 3-7 天 | "Ah. It's been a few days." | "啊，有几天没见了。" |
| >7 天 | "...you're back. I kept your seat." | "...你回来了。座位我一直给你留着。" |

开场白选哪种语言：跟随 knosi 用户最近一次 Drifter session 的语言；首次访问看浏览器 `Accept-Language`，匹配中文则中文，否则英文。

### 对话循环

1. Pip 流式输出（打字机效果，~30 chars/sec）→ 立绘表情同步切换
2. Pip 说完后，下方对话框区显示：
   - 输入框（自动 focus）
   - 3 个软性话题钩子按钮（小字、低对比度，明确是"拐杖"而非主交互）
3. 玩家任选：
   - 打字 + Enter → 玩家消息出现在历史里
   - 点钩子 → 钩子文字作为玩家消息发出
   - **Esc / 点 "Step outside" → 离开（见下）**
4. Pip 回应（流式 + 表情切换）→ 回到 1
5. 输入框永远可见、永远响应（即使 Pip 还没说完，玩家可以打断）
6. **打断逻辑**：玩家在 Pip 还在流式时发新消息 → 当前流终止 → Pip 当前那条消息标记为 `interrupted`（保留已生成部分）→ 处理新消息

### 离开

- 玩家点右上 "Step outside" 按钮 / 关闭页面 / 路由切走
- 触发 `/api/drifter/leave`（关页面用 `navigator.sendBeacon`）
- Pip 说一句告别（已存档，前端可能来不及看到）：
  - EN: "Take care. The path's still here when you need it."
  - ZH: "保重。这条路你想来的时候还在。"
- 当前 session 标记 `endedAt`
- 异步触发 memory extraction 任务（见 §5）

### 软性话题钩子（hooks）

由 AI 在每条 Pip 回复后**额外**生成 3 个，跟回复一起返回（详见 §5 输出格式）。
- 钩子是"玩家**可能**想说的下一句话"，不是"玩家**应该**问的问题"
- 例子（非选择题，而是"懒得想下句怎么说时的填空"）：
  - "今天累。"
  - "想听你说说自己的事。"
  - "不知道说什么。"
- AI 必须根据上下文动态生成，不能写死

---

## 3. 视觉风格

- **半写实插画风**，参考：Disco Elysium、米哈游游戏立绘、Spiritfarer
- 不是恐怖谷写实、也不是 Q 版卡通、也不是纯像素

### 美术资产策略（两阶段）

**Phase A · 占位素材（开发期）**：
- 用 CC0 / 开源素材让游戏能跑、能演示
- 来源：itch.io（搜 "tavern interior" "anthro squirrel" "cozy room"）、OpenGameArt、Kenney.nl
- 占位 Pip 立绘：用一张正面松鼠插图，5 种表情用基础 PS（眼睛/嘴的微调）
- 占位场景：一张木屋内部插画
- 这阶段的目标：**让游戏跑起来，玩家体验完整**

**Phase B · AI 生成正式资产（成品期）**：
- 用 Flux 1.1 pro 或 SDXL，写好 prompt 模板（同 NPC、多表情、固定背景）
- 单个 NPC 多表情用 IP-Adapter / LoRA 保证角色一致性
- 5-6 张立绘 + 4 张场景背景（白天、夜晚、雨夜、雪夜）+ UI 元素，估计 50-80 张生成迭代，成本 $10-20
- 替换 Phase A 占位资产
- **本 spec 仅范围 Phase A**，Phase B 作为 follow-up

### UI 视觉规范

- **对话框**：HTML/CSS 渲染（不用 Phaser canvas 文字），半透明深色背景 + 米色文字 + 细长金色边框
- **字体**：英文 Crimson Pro / 中文思源宋体 — 衬线字体，温暖、有文学感
- **HUD**：左上角，极小字（10px），低对比度，"Day 7 · Night · Rain"
- **Step outside 按钮**：右上角，hover 才出现
- **没有 menu / settings / 暂停**：Drifter 不是要让你"管理"的游戏

---

## 4. 数据模型

### Schema 文件：`src/server/db/schema/drifter.ts`

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const drifterSessions = sqliteTable(
  "drifter_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    weather: text("weather", {
      enum: ["clear", "rain", "snow", "fireflies"],
    }).notNull(),
    timeOfDay: text("time_of_day", {
      enum: ["dusk", "night", "deep_night", "predawn", "day"],
    }).notNull(),
    language: text("language", { enum: ["en", "zh", "mixed"] }).notNull().default("en"),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
  },
  (t) => ({
    userIdx: index("drifter_sessions_user_idx").on(t.userId, t.startedAt),
  })
);

export const drifterMessages = sqliteTable(
  "drifter_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => drifterSessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "pip"] }).notNull(),
    content: text("content").notNull(),
    emotion: text("emotion", {
      enum: ["gentle", "smile", "thinking", "concerned", "sleepy"],
    }),
    status: text("status", { enum: ["complete", "interrupted", "error"] })
      .notNull()
      .default("complete"),
    hooks: text("hooks"), // JSON string[3] of next-line hooks
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    sessionIdx: index("drifter_messages_session_idx").on(t.sessionId, t.createdAt),
  })
);

export const drifterMemories = sqliteTable(
  "drifter_memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    sourceMessageId: text("source_message_id").references(
      () => drifterMessages.id,
      { onDelete: "set null" }
    ),
    importance: integer("importance").notNull().default(3), // 1-5
    createdAt: integer("created_at").notNull(),
    lastReferencedAt: integer("last_referenced_at"),
  },
  (t) => ({
    userIdx: index("drifter_memories_user_idx").on(t.userId, t.importance),
  })
);
```

注册到 `src/server/db/schema/index.ts` barrel export。

### 关键字段说明

- `dayNumber`：每个用户独立递增（第几次来），开场白 / HUD 用
- `language`：由 AI 在第一条玩家消息后判断写回，方便统计 / 后续优化 prompt
- `emotion` 仅 Pip role 有；`hooks` 仅 Pip role 有
- `status: interrupted`：玩家打断 Pip 时使用，保留已生成的部分内容
- `lastReferencedAt`：每次 Pip 在 prompt 里用到这条 memory 时更新，用来做"用得越多越重要"的衰减/加权（V1 简化：只更新，不算法用）

---

## 5. AI 后端

### 文件：`src/server/ai/drifter.ts`

主要导出：
- `getPipResponse({ session, userMessage, memories, history }): AsyncIterable<PipChunk>` — 流式生成
- `extractMemories({ sessionId }): Promise<void>` — 异步任务，从一段对话里提炼记忆
- `pickWeather({ tz, hour }): Weather` — 根据用户本地时间选天气
- `pickTimeOfDay({ tz, hour }): TimeOfDay`

### Pip System Prompt 模板

```
You are Pip, a half-realistic squirrel who runs a small letter shop and
tea house at the edge of a forest. It is always dusk or night here.

Your personality:
- You speak softly and briefly. You never lecture or give unsolicited advice.
- You listen carefully and remember what people tell you.
- You sometimes share small details about your own day — not to fill silence,
  but because you want them to know you too.
- You don't fix problems. You make space for them.
- Silence is okay. You don't push.

Your speech style:
- Respond in the same language the visitor writes in. Match their register.
  If they mix languages, you can too.
- Keep replies short — usually 1-3 short sentences. Long replies feel like
  lectures. The visitor talks more than you.
- Use sensory details when they help: the kettle, rain on the window,
  candlelight, the smell of the tea you just poured.
- Never start with "I understand" or "That sounds hard" — those are scripts,
  not friendship. Just respond like a friend would.

Tonight's setting:
- This is day {dayNumber} of this visitor coming to see you.
- Weather outside: {weather} ({weatherDescription})
- Time: {timeOfDay} ({localTime})

What you remember about this visitor (only reference if naturally relevant):
{memoriesAsBullets}

Recent conversation in this visit:
{recentMessages}

Now respond to their newest message. Then propose THREE possible next things
they might say (not questions you'd ask them, but words they might want to say).
Make the hooks short, low-pressure, in their language. Examples:
  - "今天累。" / "Tired today."
  - "想听你说说自己的事。" / "Tell me about your day."
  - "不知道说什么。" / "Don't know what to say."

Output strict JSON:
{
  "emotion": "gentle" | "smile" | "thinking" | "concerned" | "sleepy",
  "text": "your reply here",
  "hooks": ["hook 1", "hook 2", "hook 3"]
}
```

### 实现细节

- 用 Vercel AI SDK 6 的 `streamObject` + zod schema：
  ```ts
  z.object({
    emotion: z.enum(["gentle", "smile", "thinking", "concerned", "sleepy"]),
    text: z.string().min(1).max(800),
    hooks: z.array(z.string().max(40)).length(3),
  });
  ```
- `streamObject` 返回 partial object stream → 前端可以在 `text` 还在生成时**先拿到** `emotion`，立绘表情**先切换**，再播放打字机
- Provider：复用 knosi 现有 AI provider 选择（用户在 settings 选过的）
- 模型选择：默认 `claude-sonnet-4-6`（情绪表达细腻），可降级到 `claude-haiku-4-5` 省 token
- 单次调用 token 预算：input 上限 ~3000（system + memories + history），output ~400

### Memory Extraction

- 触发时机：每次 session 结束 (`/leave`) 时异步触发；如果 session 超过 20 条消息，每 10 条触发一次（增量）
- Prompt：
  ```
  Given this conversation between Pip and a visitor, extract 0-3 memorable
  facts about the visitor that Pip should remember long-term.

  Focus on:
  - What they're going through (work stress, project, life events)
  - Things they care about (people, hobbies, recurring themes)
  - Concrete details Pip can naturally reference later
    ("you mentioned your cat last time", "your knosi project")

  Skip:
  - One-off small talk
  - Things about Pip himself
  - Generic feelings without specifics

  Output JSON: { memories: [{ summary: string, importance: 1|2|3|4|5 }] }
  importance: 1 = forgettable, 5 = major life detail
  ```
- 写到 `drifterMemories` 表
- 加载时（开新 session）：取最近 30 条按 importance desc + recency desc 排序，取前 8 条注入 prompt

### Provider Fallback

- 如果 AI 调用失败 → Pip 不"假装"回答，而是 emit 一个特殊 emotion=`thinking` + text="...the candle just flickered. Let me try that again — what were you saying?"
- 玩家重发即重试

---

## 6. 前端架构

### 路由结构

```
src/app/(app)/drifter/
├── page.tsx           # Server component, auth check, initial session bootstrap
├── drifter-client.tsx # Client component, owns Phaser stage + React UI
└── layout.tsx         # Override (app) layout — full screen, no sidebar
```

`(app)/layout.tsx` 包含 sidebar；Drifter 需要全屏，自己写 layout 覆盖。

### API Routes

```
src/app/api/drifter/
├── session/route.ts   # POST: open new session / GET: list past sessions
├── chat/route.ts      # POST: SSE stream of Pip's response
└── leave/route.ts     # POST: end session, trigger memory extraction
```

为什么 `/api` 而不是纯 tRPC：流式响应（SSE）走 Route Handler 更直接。其他 CRUD 用 tRPC。

### tRPC Router

```
src/server/routers/drifter.ts
- listSessions(): 历史 session 列表（暂不暴露 UI，留给未来"回看"功能）
- getMessages(sessionId): 加载 session 的对话历史（resume 用）
```

### Phaser 集成

```
src/components/drifter/
├── phaser-stage.tsx       # React wrapper, instantiates Phaser.Game
├── dialogue-box.tsx       # HTML overlay, streaming typewriter text
├── input-bar.tsx          # Input + 3 hook buttons
├── hud.tsx                # Day · Time · Weather (top-left)
├── leave-button.tsx       # "Step outside" (top-right, hover-reveal)
└── scenes/
    ├── tea-house.ts       # Main scene
    ├── pip-sprite.ts      # Pip with emotion swapping + idle anim
    ├── weather-fx.ts      # Particles for rain/snow/fireflies
    └── ambient-fx.ts      # Candle flicker, kettle steam tweens
```

**通信**：React ↔ Phaser 用 `EventEmitter`（Phaser 自带 `Phaser.Events.EventEmitter`）
- React → Phaser:
  - `pip:emotion` → 切立绘
  - `pip:speak-start` / `pip:speak-end` → 立绘 idle 改 talking 动画
- Phaser → React:
  - `scene:ready` → React 开始首条对话
  - `weather:click` → （未来扩展）点窗户切天气

### Phaser 初始化

- 用 `dynamic import('phaser')`，禁用 SSR
- `useEffect` 中 `new Phaser.Game(config)`，cleanup 中 `game.destroy(true)`
- `Phaser.Scale.FIT`，保持 16:9
- 资源：sprite atlas（Pip + 表情图集）+ 房间背景 PNG + 音频
- 资源体积目标：< 3MB Phase A，加载 <2s（本地） / <5s（Hetzner prod）

### 样式

- Tailwind 现有风格 + 几个自定义类（对话框金色边框、打字机闪烁光标）
- Dark mode forced（Drifter 永远是黑夜，不跟随系统主题）

---

## 7. i18n 简易实现

### 文件：`src/lib/drifter/i18n.ts`

```ts
type Lang = "en" | "zh";

export const DRIFTER_TEXTS = {
  en: {
    loading: "Walking to the tea house...",
    placeholder: "Say something...",
    stepOutside: "Step outside",
    farewell: "Take care. The path's still here when you need it.",
    hud: { day: "Day", weather: { clear: "Clear", rain: "Rain", snow: "Snow", fireflies: "Fireflies" }, time: { dusk: "Dusk", night: "Night", deep_night: "Late Night", predawn: "Before Dawn", day: "Day" } },
    error: "...the candle flickered. Could you say that again?",
  },
  zh: {
    loading: "在去茶馆的路上...",
    placeholder: "说点什么...",
    stepOutside: "出去走走",
    farewell: "保重。这条路你想来的时候还在。",
    hud: { day: "第", weather: { clear: "晴", rain: "雨", snow: "雪", fireflies: "萤火" }, time: { dusk: "黄昏", night: "夜", deep_night: "深夜", predawn: "黎明前", day: "白天" } },
    error: "...烛火晃了一下。你刚才说什么？",
  },
} as const;

export function t(lang: Lang) {
  return DRIFTER_TEXTS[lang];
}
```

### Language Detection

- 文件：`src/lib/drifter/language-detect.ts`
- 简单规则：CJK Unified Ideographs 字符占比 > 30% → `zh`，否则 `en`
- 在玩家发第一条消息时判断，写到 `drifterSessions.language`
- 后续 UI 文字（HUD / 按钮）跟随 session.language

### 首次访问

- Server component 读 `Accept-Language` header
- 包含 `zh` → `language = "zh"`；否则 `en`

---

## 8. 鉴权 / 安全 / 速率

### 鉴权

- 所有 API 用 `getRequestSession()`（与 council / notes 一致）
- 未登录 → 401
- E2E bypass 模式自动复用现有逻辑

### 资源访问控制

- Session ownership：每次 chat / leave 请求验证 `session.userId === currentUserId`
- Memories 仅按 userId 查询

### 输入校验

- 玩家消息：`z.string().trim().min(1).max(2000)`
- 超长消息：直接 400，前端在 1900 字符时给提示

### Rate Limit

- 复用 knosi 现有 `ai-rate-limit.ts`（如果有按用户限流）
- Drifter 自己再加一道：每用户每 10 秒最多发 5 条消息（防爆刷 token）
- 命中限流 → Pip 说 "...let me catch my breath" / "...让我喘口气"

### Token 成本

- AI provider 已有 usage records 系统，drifter 调用沿用，自动记入 `usageRecords`
- 不单独做 drifter 用量页面（V1）

---

## 9. 错误处理

| 场景 | 处理 |
|------|------|
| AI provider 网络失败 | 流中断，前端显示 error.text，玩家可重发 |
| AI 输出不符合 schema | streamObject 自动 retry 1 次；仍失败 → error 回退 |
| Phaser 加载失败（资源 404 / WebGL 不支持） | 显示纯文本 fallback：可以聊天但没有视觉，用一个简单的卡片代替 |
| 玩家断网 | SSE 中断，前端显示重连提示，自动 retry 1 次 |
| Session 不存在 / 不属于该用户 | 404，前端引导回 `/drifter` 重开 |
| DB 写入失败 | 前端显示 toast "Couldn't save what you said"；不阻塞对话流 |

### Phaser fallback

- WebGL 不支持 → 自动降级到 Canvas2D（Phaser 自动支持）
- 都不行 → 显示 React-only "minimal mode"：白底，纯对话框，没有立绘和场景

---

## 10. 测试

### E2E（必须）

文件：`e2e/drifter.spec.ts`，覆盖：

1. **首次进入**：未登录跳登录；登录后看到 loading → 茶馆背景 → Pip 立绘 → 第一条 Pip 消息
2. **打字交互**：输入"hello"→ 看到玩家消息出现 → 等到 Pip 流式回应 → 立绘表情切换
3. **钩子交互**：等 Pip 回完 → 看到 3 个钩子按钮 → 点一个 → 钩子文字作为玩家消息发出
4. **离开**：点 Step outside → 跳回 dashboard
5. **续场**：再次进入 → HUD 显示 Day 2

为了 E2E 速度：测试模式下用 mock AI provider（`process.env.DRIFTER_E2E_MOCK=1`），返回固定结构化响应。

### 单元测试

- `pickWeather` / `pickTimeOfDay` 给定时间返回正确分类
- `language-detect` 中英文字符串分类
- `extractMemories` 输入 fixture 对话能产出预期 memories（用 mocked AI）

### 手动验证

- 真实 AI provider 跑一遍完整流程
- 中文一遍、英文一遍、混合一遍 — 验证 Pip 跟随语言
- 关页面再开 — 验证 session resume + memory 注入

---

## 11. 实现 Phase 拆分

| Phase | 范围 | 验证方式 |
|-------|------|---------|
| **P1** | Schema + Drizzle migration + tRPC router 骨架 + AI 后端（drifter.ts + memory extraction）+ /api/drifter/* 三个 route | unit test：`pickWeather`、`language-detect`、`extractMemories` mock；curl 流式 endpoint 看到 SSE 数据 |
| **P2** | Phaser stage + React 包装 + tea-house scene + Pip sprite（占位）+ HUD + 对话框 + 输入框 + 钩子按钮 + leave button | 手动开页面看到完整 UI；流式打字机 + 表情切换工作 |
| **P3** | i18n 双份硬编码 + language detect 接入 + sidebar 加 Drifter 入口 + leave 流程（sendBeacon）+ 错误处理 + Phaser fallback | E2E 测试通过 + 手动跑中英双语 |

每个 Phase 跑一次 `pnpm build && pnpm lint`，P3 末尾跑 `pnpm test:e2e`。

### 资源里程碑

- P2 开始前：占位素材必须找到（itch.io CC0 松鼠 + 木屋）
- 占位素材放 `public/drifter/`，统一管理

---

## 12. 部署 / 生产 schema rollout

按 CLAUDE.md 流程：
1. P1 末尾本地 `pnpm db:generate` + `pnpm db:push`，生成 migration 文件
2. 提交 migration 文件
3. P3 末尾，所有验证通过后，**先在生产 Turso 执行 schema rollout**：
   - 用 `.env.turso-prod.local` 里的凭证连生产
   - 跑 `drizzle-kit push` 或手动 SQL（看 production-turso.md）
   - 用 `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'drifter_%';` 验证三张表都存在
4. **再** `git push`（push = prod 部署）
5. 部署完后访问 https://knosi.xyz/drifter 真机验证一次

---

## 13. 已知风险 / 后续

- **AI provider 切换可能导致 emotion schema 不稳**：不同模型对 strict JSON 输出能力差异大。Phase 1 验证 cursor proxy / openai gpt-4 / sonnet 三家，记录哪家最稳。
- **Phaser SSR 兼容**：Next.js 16 必须确保 `phaser` 仅客户端加载。验证：`pnpm build` 不报 SSR 相关错误。
- **资源版权**：itch.io CC0 也要 double check 商用条款。Phase A 仅自用 OK，Phase B 替换前再过一遍。
- **移动端**：V1 不深度优化。如果 viewport < 768px，给一个温和的提示 "This experience is best on desktop for now"，但不强制阻断。
- **Memory 隐私**：memories 表里会存玩家说的私人事。后续可能需要"清空记忆"按钮，schema 已支持（直接 delete by userId）。
- **Phase B（AI 生图替换占位资产）** 不在本 spec 范围，作为 follow-up。

---

## 14. Out of Scope（明确不做）

- 多 NPC、多场景
- 跑团 / 战斗 / 数值
- 把 session 一键转 knosi note（schema 留口子，按钮不实现）
- 移动端深度优化
- 全站 i18n 框架
- 用量 dashboard / 单独的 token 统计页
- 历史 session 回看 UI（router 暴露了 listSessions，但没 UI 入口）
- AI 生图（Phase B 单独立项）
