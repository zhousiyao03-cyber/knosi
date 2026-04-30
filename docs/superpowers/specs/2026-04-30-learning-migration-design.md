# 2026-04-30 — Learning Module Migration & Card Authoring

## Goal

把现有 notes 表里"学习相关"的笔记（八股文、分析文章等）迁移到 learning 模块，让 learning 成为复习/学习理论知识的真正主场。配套：

- learning 模块从空壳升级成可用产品（topic 列表 → 题目列表 → 题目详情，带 view 计数和三档掌握度）
- bagu skill（八股 Q&A 生成）从写 notes 改成写 learning，未来产新题直接进 learning
- 一次性脚本完成存量迁移，notes 表里的源记录硬删

## Non-Goals

- SRS / 间隔重复 / due date / 自动调度
- AI 出题（`generateReview` / `ask` 现存 procedure 暂不挂 UI）
- /notes 页面加 "Move to Learning" 按钮（一次性脚本足够，不做常驻 UI）
- 题目搜索 / 跨 topic 拖拽 / 复习提醒
- notes 软删字段（备份责任由迁移前的 Turso dump 兜底）

## Background

- notes 表已有 `八股文` folder，由 bagu skill 通过 MCP `create_note` 工具持续写入
- learning 模块 schema 已存在三层结构：`learningTopics` → `learningNotes` → `learningReviews`
- `/learn` 页面当前是 redirect 到 `/notes`（空壳）
- `learningNotes.content` 当前语义是纯文本；notes.content 是 Tiptap JSON 字符串
- 没有任何已存在的迁移/转移代码

## Architecture Overview

```
Notes 模块（保持原样）
   │
   │ 一次性脚本 scripts/migrate-notes-to-learning.ts
   │   读 → 转换 → 写 → 删（硬删）
   ▼
Learning 模块
   ├─ learningTopics      （不变）
   ├─ learningNotes       （加 viewCount / mastery / lastViewedAt 三字段；
   │                        content 语义升级为 Tiptap JSON 字符串）
   └─ learningReviews     （不变，暂不用）
        ▲
        │
   /learn UI（重写）
        ├─ /learn                       Topic 列表
        ├─ /learn/[topicId]             Topic 详情：题目列表
        └─ /learn/[topicId]/[noteId]    题目详情：Tiptap 只读 + 三档评级

MCP 入口（增量）
   └─ create_learning_card 新工具 → upsertCardFromMcp procedure
        bagu skill 改一行调用，未来八股直接进 learning
```

边界：
- Notes 模块完全不变（仅被脚本读取一次然后被删）
- Learning 是新家
- /notes 不加迁移按钮
- 一次性脚本搬完即弃
- bagu skill 改写后形成 MCP→learning 闭环

## Data Model

### `learningNotes` 加三字段

`src/server/db/schema/learning.ts` 中追加：

```ts
viewCount: integer("view_count").notNull().default(0),
mastery: text("mastery", { enum: ["not_started", "learning", "mastered"] })
  .notNull()
  .default("not_started"),
lastViewedAt: integer("last_viewed_at", { mode: "timestamp_ms" }),  // nullable
```

| 字段 | 类型 | 默认 | 含义 |
|------|------|------|------|
| `viewCount` | integer | 0 | 进入题目详情页累加（前端 5 分钟防抖） |
| `mastery` | text enum | `not_started` | 三档：未学 / 学习中 / 已掌握 |
| `lastViewedAt` | timestamp_ms (nullable) | null | 最近一次进入详情页的时间，列表排序用 |

### `learningNotes.content` 语义升级

现状是纯文本字段。约定升级为 **Tiptap JSON 字符串**，列类型 `text` 不变（SQLite 无 JSON 类型）。`plainText` 字段照旧存派生纯文本，用于搜索。

不需要 ALTER COLUMN，仅应用层写入逻辑变化。迁移过程把 notes 的 Tiptap JSON 字符串直接搬过去。

### 不动的字段 / 表

- `learningNotes.id` / `topicId` / `userId` / `title` / `tags` / `createdAt` / `updatedAt`
- `learningTopics` 表完全不动
- `learningReviews` 表完全不动
- `notes` 表完全不动

### Migration 流程

```bash
pnpm db:generate    # 生成 drizzle migration（三个 ALTER TABLE ADD COLUMN）
pnpm db:push        # 应用到本地 SQLite
```

生产 Turso rollout：
- 用 `.env.turso-prod.local` 凭证（参考 `.claude/rules/production-turso.md`）
- 执行迁移产出的 SQL（三条非破坏性 ADD COLUMN）
- 用 `SELECT name FROM pragma_table_info('learning_notes')` 验证三列存在
- changelog 中记录命令和验证结果

### 索引

不加新索引。topic 内 note 数量预期 < 100 量级。

## tRPC Router 改动

文件：`src/server/routers/learning-notebook.ts`

### 改：`listTopics`

返回字段加 `cardCount` / `masteredCount` / `lastReviewedAt`，通过 LEFT JOIN + GROUP BY 聚合：

```sql
SELECT t.*,
  COUNT(n.id) AS card_count,
  SUM(CASE n.mastery WHEN 'mastered' THEN 1 ELSE 0 END) AS mastered_count,
  MAX(n.last_viewed_at) AS last_reviewed_at
FROM learning_topics t
LEFT JOIN learning_notes n ON n.topic_id = t.id
WHERE t.user_id = ?
GROUP BY t.id
ORDER BY t.updated_at DESC
```

### 改：`listNotes`

返回字段补 `viewCount` / `mastery` / `lastViewedAt`。新增排序与筛选：

```ts
listNotes: publicProcedure
  .input(z.object({
    topicId: z.string(),
    sort: z.enum(["unmastered_first", "recent", "alphabetical"])
      .default("unmastered_first"),
    filter: z.enum(["all", "not_mastered", "mastered"]).default("all"),
  }))
```

`unmastered_first` 排序逻辑：
```sql
ORDER BY 
  CASE mastery WHEN 'mastered' THEN 2 ELSE 1 END,
  CASE WHEN last_viewed_at IS NULL THEN 0 ELSE 1 END,
  last_viewed_at ASC
```

筛选：`not_mastered` 包含 `not_started` + `learning`。

### 新：`incrementView`

```ts
incrementView: publicProcedure
  .input(z.object({ noteId: z.string() }))
  .mutation(async ({ input }) => {
    await db.update(learningNotes)
      .set({
        viewCount: sql`view_count + 1`,
        lastViewedAt: new Date(),
      })
      .where(eq(learningNotes.id, input.noteId));
    return { ok: true };
  }),
```

防抖在前端 sessionStorage 做（5 分钟），后端忠实记录每次 mutation。

### 新：`updateMastery`

```ts
updateMastery: publicProcedure
  .input(z.object({
    noteId: z.string(),
    mastery: z.enum(["not_started", "learning", "mastered"]),
  }))
  .mutation(async ({ input }) => {
    await db.update(learningNotes)
      .set({ mastery: input.mastery, updatedAt: new Date() })
      .where(eq(learningNotes.id, input.noteId));
    return { ok: true };
  }),
```

### 新：`upsertCardFromMcp`（MCP 工具内部使用）

```ts
upsertCardFromMcp: publicProcedure
  .input(z.object({
    userId: z.string(),
    topicName: z.string().min(1),
    title: z.string().min(1),
    content: z.string(),
    contentFormat: z.enum(["tiptap_json", "markdown"]).default("markdown"),
    plainText: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }))
  .mutation(async ({ input }) => {
    // 1. get-or-create topic by (userId, topicName)
    // 2. 转换 content：markdown → Tiptap JSON（用 prosemirror-markdown）
    // 3. plainText 不传时从 Tiptap JSON 派生
    // 4. INSERT learning_notes (viewCount=0, mastery='not_started', lastViewedAt=null)
    // 5. 返回 { topicId, noteId }
  })
```

关键设计：
- `userId` 从 input 传，因为 MCP 通过 OAuth 认证，跟 web session 不同源
- `contentFormat` 默认 `markdown`（bagu skill 产出 markdown），后端做转换
- `topicName` 当 key 做 get-or-create，同名复用、新名新建

### 不动的 procedure

- `createNote` / `updateNote` / `deleteNote`：UI 直接复用
- `createTopic` / `updateTopic` / `deleteTopic`：UI 直接复用
- `generateReview` / `ask`：保留，暂不挂 UI

### 新工具：`markdownToTiptapJson`

文件：`src/server/learning/markdown-to-tiptap.ts`

实现：依赖 `prosemirror-markdown`（新增依赖），把 markdown 解析为 ProseMirror Node，再序列化为 JSON 字符串。Schema 沿用 Tiptap 默认 schema 兼容能力（基础节点：heading / paragraph / code_block / list_item / bullet_list / ordered_list / blockquote / text + marks）。复杂节点（callout / mermaid / excalidraw 等自定义块）不在 markdown→JSON 还原范围内，bagu 八股卡片不需要这些。

派生 plainText：从 Tiptap JSON 提取所有 `text` 节点拼接（已有相似逻辑可复用，若无则简单 walk）。

## MCP Tool

文件：`src/server/integrations/mcp-tools.ts`

### 新增工具定义

```ts
{
  name: "create_learning_card",
  description:
    "Create a learning card in the user's Knosi learning module. " +
    "Use this for interview-prep Q&A cards, study notes, and theory review content. " +
    "Cards are grouped by topic; new topics are created on first use.",
  inputSchema: {
    type: "object",
    properties: {
      topicName: {
        type: "string",
        description: "Topic name to group cards under. Created if missing.",
      },
      title: { type: "string" },
      body: {
        type: "string",
        description: "Markdown content of the card.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["topicName", "title", "body"],
  },
}
```

### dispatcher 分支

`callKnosiMcpTool` 新增 `case "create_learning_card"`，调用 `upsertCardFromMcp`（通过 deps 注入而不是直接 import router，保持测试性）。

### bagu skill 改写

`~/.claude/skills/bagu/SKILL.md` 中的 MCP 调用从 `create_note({ folder, title, body })` 改为 `create_learning_card({ topicName, title, body, tags })`。其他逻辑（六段模板、tag 处理、parse confirm）不动。

> 注：bagu skill 在 repo 外（`~/.claude/skills/`），改动在本任务范围内手动修改并文档化，但不会出现在本次 PR 的 diff 里。

## Migration Script

文件：`scripts/migrate-notes-to-learning.ts`

执行：`pnpm tsx scripts/migrate-notes-to-learning.ts <config.json> [--env=local|prod] [--apply]`

默认 `--env=local`、不带 `--apply` = dry-run。

### 输入：`scripts/migrate-config.json`（加入 .gitignore）

```json
{
  "userId": "<userId>",
  "topics": [
    {
      "topicName": "八股文",
      "source": { "kind": "folder", "folderName": "八股文" }
    },
    {
      "topicName": "React 原理",
      "source": { "kind": "noteIds", "ids": ["uuid-a", "uuid-b"] }
    },
    {
      "topicName": "浏览器渲染",
      "source": { "kind": "tag", "tag": "browser" }
    }
  ],
  "deleteSourceNotes": true
}
```

三种 source kind：
- `folder` — 按 folder name 抓全部 note
- `noteIds` — 按 ID 列表抓
- `tag` — 按 tag JSON contains 抓

### 流程

1. 解析 config，校验 userId
2. 根据 `--env` 选择 db 连接（local SQLite / prod Turso via `.env.turso-prod.local`）
3. **如果 `--env=prod`**：检查 `backups/` 目录下是否存在当天日期的 dump 文件（`backups/turso-YYYY-MM-DD.sql`）。不存在则退出，提示先运行 `turso db dump`
4. 对每个 topic 配置：
   a. 按 source 查 notes
   b. 打印 dry-run 报告：
      - "将创建 / 复用 topic: X"
      - "将搬运 N 条 note: [titles...]"
      - "将删除源 note: N 条"
5. 如果未传 `--apply` → 退出
6. 如果传了 `--apply`：
   - 交互式二次确认（即使 deleteSourceNotes=true）：`确认搬运并删除源 note? y/n`
   - 在事务里：
     - get-or-create learningTopics(userId, name)
     - 对每条 note：
       - INSERT learningNotes（content/plainText/tags 直接搬运；createdAt/updatedAt 保留原值；viewCount=0, mastery='not_started', lastViewedAt=null）
       - IF deleteSourceNotes: DELETE FROM notes WHERE id=note.id
   - 打印结果统计
7. 结束后追加一条 changelog 条目（手动 commit）

### 安全机制

- dry-run 默认（`--apply` 才会写入）
- `--env=prod` 强制要求当日 dump 文件存在
- 每个 topic 一个事务，失败回滚
- 重跑保护：检测目标 topic 下是否已有同 title 的 note，存在则跳过并打印警告
- 二次交互式确认（`node:readline`）

### 不在脚本职责范围内

- 备份本身（用户跑 `turso db dump > backups/turso-<日期>.sql`）
- 生产 schema migration（先 push schema 再跑迁移脚本）

## UI

### 路由结构

```
/learn                          → Topic 列表
/learn/[topicId]                → Topic 详情：题目列表
/learn/[topicId]/[noteId]       → 题目详情：Tiptap 只读 + 三档评级
/learn/[topicId]/new            → 新建题目页
```

### `/learn` (Topic 列表页)

- 重写 `src/app/(app)/learn/page.tsx`，去掉 redirect
- 顶部 "Learning" 标题 + "New Topic" 按钮（弹 dialog）
- 主区 grid 布局，每张 topic 卡片：
  - topic 名称
  - `12 cards · 3 mastered`
  - 最近复习时间（`Last reviewed 3d ago` / `Never reviewed`）
- 点卡片跳 `/learn/[topicId]`

### `/learn/[topicId]` (Topic 详情)

- 顶部：返回链接 + topic 名 + 编辑/删除菜单 + "Add Card" 按钮 → `/learn/[topicId]/new`
- 三个 tab: `All` / `Not Mastered` / `Mastered`
- 题目列表，每行：
  - 标题
  - tag chips
  - viewCount 徽章（眼睛图标）
  - mastery 徽章（gray-500 / blue-500 / green-500）
  - lastViewedAt 相对时间（`3d ago` / `Never`）
- 默认排序：unmastered_first

### `/learn/[topicId]/[noteId]` (题目详情)

- Header（吸顶）：
  - 返回 → topic 详情
  - 标题
  - 右侧 segmented control：`Not yet` / `Learning` / `Mastered`，当前值高亮，点击立即写库
  - 右上角 ⋯ 菜单：Edit / Delete
- 主区：
  - metadata 行：`Viewed N times · Last seen Xd ago · Tags: ...`
  - Tiptap **只读**渲染（`editable: false`）
  - 编辑按钮切换 `editable: true`，保存后切回
- 进入页面 mount 时调 `incrementView`：sessionStorage key `learn:view:<noteId>` 存上次时间戳，5 分钟内不重复触发

### `/learn/[topicId]/new` (新建题目)

- title input + Tiptap 编辑器 + tag input
- 保存后跳到题目详情

### 视觉与文案

- Tailwind v4 沿用，`cn()` 工具函数
- 用户可见文案全英文（CLAUDE.md 规范）
- mastery 颜色：未学 gray-500 / 学习中 blue-500 / 已掌握 green-500（dark mode 用 -400）
- 完整 dark mode 支持

## Error Handling

| 场景 | 处理 |
|------|------|
| MCP `create_learning_card` 收到空 topicName / title | 返回 zod 校验错误 |
| `upsertCardFromMcp` 转换 markdown 失败 | 记录原 markdown 到 plainText，content 字段存 fallback Tiptap JSON（一个 paragraph 包裹原文） |
| 迁移脚本读到的 note.content 不是合法 JSON | 跳过该条 note，记入失败列表，最终汇总 |
| 迁移脚本写入 learning_notes 失败 | 整个 topic 事务回滚，打印错误，继续下一个 topic |
| 题目详情页 `incrementView` mutation 失败 | 静默失败（toast 不弹），日志打 warn |
| `updateMastery` 失败 | toast 弹错误，UI segmented control 回滚到原值（optimistic + rollback） |
| 题目详情页 noteId 不存在 | 404 |
| topic 删除时下面还有 note | tRPC procedure 已存在的 `deleteTopic` 行为遵循现有实现（cascade or block）—— 阅读 `learning-notebook.ts:deleteTopic` 后保持一致，必要时加 confirm dialog |

## Testing

### 单元测试（vitest）

- `src/server/learning/markdown-to-tiptap.test.ts`：覆盖 heading / paragraph / code_block / list / bold / italic / link / inline code 八种基础场景
- `src/server/routers/learning-notebook.test.ts`（如不存在则新增）：覆盖 `listTopics` 聚合、`incrementView` 自增、`updateMastery` 写入、`upsertCardFromMcp` get-or-create + insert 闭环
- `src/server/integrations/mcp-tools.test.ts`（增量）：`create_learning_card` 的 dispatcher 转发

### E2E 测试（Playwright）

文件：`e2e/learning.spec.ts`

覆盖：
1. 新建 topic → 跳详情 → 添加 1 张卡 → 列表能看到
2. 进入卡片详情 → viewCount 从 0 → 1
3. 点 Mastered → 列表回退后徽章显示绿色 + Mastered tab 能筛出
4. 进入第二次详情（5 分钟内）→ viewCount 仍是 1（防抖生效）
5. 删除卡 → 列表减少
6. MCP-style upsert（直接调 trpc）：传 `topicName="测试"` → topic 列表出现新 topic、卡片 1 张

### 迁移脚本验证

- 在本地 SQLite 上跑 dry-run，确认报告
- 跑 `--apply` on local，验证 learning_notes 写入正确、源 notes 已删
- 在生产 Turso 上跑前先 dump backup
- 跑生产前再 dry-run 一次，看 topic 映射是否符合预期

### 整体自验证三步（CLAUDE.md 强制）

```bash
pnpm build
pnpm lint
pnpm test:e2e
```

## Documentation

- `docs/superpowers/specs/2026-04-30-learning-migration-design.md`（本文档）
- `docs/superpowers/plans/2026-04-30-learning-migration.md`（writing-plans 阶段产出）
- `docs/changelog/2026-04-30-learning-migration.md`（实现完成后的 changelog）
- `README.md` 更新 learning 模块状态
- `~/.claude/skills/bagu/SKILL.md` 改 MCP 调用名（项目外修改）

## Rollout Plan

1. Worktree `feat/learning-migrate` 实现 schema 改动 + router + UI + MCP 工具 + 迁移脚本
2. 本地 build / lint / e2e 全部通过
3. 生产 Turso schema rollout（三条 ADD COLUMN，记录命令到 changelog）
4. 生产 Turso dump 备份
5. 用户准备 `migrate-config.json`（手动列 topic 映射）
6. dry-run 检查报告
7. `--apply --env=prod` 跑迁移
8. 验证 `/learn` 页面 + bagu skill 改写后 MCP 流程
9. 合并 PR、push main 触发 Hetzner 部署

## Risks & Open Questions

- **markdown→Tiptap JSON 的还原度**：`prosemirror-markdown` 默认 schema 不包含 Tiptap 的自定义块（callout / mermaid 等），但 bagu 八股卡片只用基础 markdown 能力（heading / list / code / inline marks），覆盖足够。如果未来 bagu 想生成 mermaid 图，需要增强转换层
- **Tiptap 自定义块在迁移过来的笔记里**：notes 里的笔记如果含有 callout / image-row / excalidraw 等自定义块，迁移时直接 copy Tiptap JSON 字符串，learning 详情页要能渲染同样的扩展。需要确认 `tiptap-editor.tsx` 在 `editable: false` 模式下，所有现有扩展依然正常渲染（默认应该可以）
- **生产 Turso 写入安全性**：迁移脚本直连生产是个不可逆操作，依赖：(a) dump 备份（脚本强制检查）（b) dry-run（默认行为）（c) 二次确认（交互式）。三层兜底应足够
- **bagu skill 改写**：本任务实现的同时手动改 `~/.claude/skills/bagu/SKILL.md`。该文件在 git 之外，改完不会被 PR 跟踪，需在 changelog 里记录原始与新版本的关键 diff
- **现有 notes 表的"分析文章"识别**：用户最初提到的"分析文章"具体是哪些笔记，本任务交由用户在 `migrate-config.json` 中以 noteIds 或 tag 形式手动指定。迁移前需确认完整清单

## Acceptance Criteria

- [ ] `learning_notes` 表存在 viewCount / mastery / lastViewedAt 三字段（本地 + 生产 Turso）
- [ ] `/learn` 页面显示 topic grid，每个 topic 显示卡数 + mastered 数 + 最近复习时间
- [ ] `/learn/[topicId]` 显示题目列表，支持三档筛选 tab，默认 unmastered_first 排序
- [ ] `/learn/[topicId]/[noteId]` 显示 Tiptap 只读内容、metadata 行、segmented control 评级
- [ ] 进入题目详情自动 +1 viewCount，5 分钟防抖生效
- [ ] 三档 mastery 切换立即写库且 UI 反馈正确
- [ ] MCP 工具 `create_learning_card` 注册成功，可被外部 client 调用
- [ ] bagu skill 改写后能直接写入 learning（手动 smoke test）
- [ ] 一次性脚本能在生产 Turso 上 dry-run 报告 + apply 实际搬运 + 删除源 note
- [ ] `pnpm build` / `pnpm lint` / `pnpm test:e2e` 全部通过
