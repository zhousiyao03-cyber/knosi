# 学习笔记本 & 开源项目分析 — 设计文档

> 日期：2026-04-02
> 状态：Draft

## 背景

用户是前端工程师，正在转向全栈方向。需要两个独立板块支持自我成长：

1. **学习笔记本** — 围绕学习主题（如 Go 语言）组织笔记，AI 协助起草和整理
2. **开源项目** — 保存和组织从外部 AI 工具获得的开源项目分析结果

## 设计决策

- 两个板块**完全独立**，各自有独立的数据表和页面路由
- **不复用现有 `notes` 表**，因为学习笔记和项目笔记各有父级关系（topic / project），混在通用 notes 里会让查询和 UI 变复杂
- **复用现有基础设施**：Tiptap 编辑器、tRPC + SQLite、AI provider、token tracking
- AI 不负责内置的开源项目代码分析（效果有限），专注在学习板块的内容协作上

---

## 板块一：学习笔记本

### 核心交互

- 按**学习主题**组织（如「Go 语言」「Docker」「数据库」）
- 每个主题下是自由笔记，随时记录
- 笔记创建支持两种方式：
  1. **空白笔记** — 从零开始写
  2. **AI 起草** — 输入主题关键词，AI 生成一份全面详细的初稿，覆盖该主题所有重要方面
- 编辑过程中 AI 持续可用（扩展、简化、润色、举例）
- AI 工具：知识大纲生成、盲点分析、复习题生成、上下文问答

### 页面结构

#### 主题列表页 `/learn`

- 改造现有 `/learn` 页面（弃用旧的 learningPaths 预设课程模式）
- 卡片列表展示所有学习主题
- 每张卡片显示：图标、主题名、描述、笔记数量、热门标签
- 顶部「+ 新主题」按钮

#### 主题详情页 `/learn/[topicId]`

两个 Tab：

**Tab 1 — 笔记**
- 笔记列表，每条显示标题、摘要预览、标签、日期
- 搜索框 + 标签筛选
- 「+ 新笔记」按钮（下拉选择：空白笔记 / AI 起草）
- 点击笔记进入 Tiptap 富文本编辑器

**Tab 2 — AI 助手**
- 四个 AI 工具入口卡片：
  - 🗺️ **生成知识大纲** — 根据所有笔记梳理知识结构和学习脉络
  - 🔍 **盲点分析** — 分析已学内容，指出可能遗漏的关键知识点
  - ❓ **生成复习题** — 根据笔记内容生成问答题
  - 💬 **问 AI** — 结合笔记上下文的个性化问答
- 下方显示历史生成记录列表

### 数据模型

**`learningTopics` 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text PK | UUID |
| userId | text FK → users | 用户 |
| title | text NOT NULL | 主题名（如「Go 语言」） |
| description | text | 简要描述/学习目标 |
| icon | text | emoji 图标 |
| createdAt | integer NOT NULL | 创建时间 |
| updatedAt | integer NOT NULL | 更新时间 |

**`learningNotes` 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text PK | UUID |
| topicId | text FK → learningTopics NOT NULL | 所属主题 |
| userId | text FK → users NOT NULL | 用户 |
| title | text NOT NULL | 笔记标题 |
| content | text | Tiptap JSON 富文本内容 |
| plainText | text | 纯文本（搜索用） |
| tags | text | JSON 数组，标签 |
| aiSummary | text | AI 生成的摘要 |
| createdAt | integer NOT NULL | 创建时间 |
| updatedAt | integer NOT NULL | 更新时间 |

**`learningReviews` 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text PK | UUID |
| topicId | text FK → learningTopics NOT NULL | 所属主题 |
| userId | text FK → users NOT NULL | 用户 |
| type | text NOT NULL | outline / gap / quiz |
| content | text NOT NULL | AI 生成的 JSON 内容 |
| createdAt | integer NOT NULL | 创建时间 |

### AI 功能细节

#### AI 起草笔记

- 用户输入主题关键词（如「并发模型」）
- AI 调用 streaming API 生成一份全面详细的初稿
- 内容要求：覆盖该主题所有重要方面，包含代码示例和解释
- 生成完毕后直接进入 Tiptap 编辑器，用户可自由修改
- 使用现有的 AI provider（OpenAI）+ token tracking

#### 编辑器内 AI 辅助

- 选中文本后出现 AI 操作菜单：扩展、简化、举例、润色
- 通过 Tiptap bubble menu 或右键菜单触发
- 流式输出，替换选中内容

#### AI 助手 Tab 工具

- **知识大纲**：读取该主题下所有笔记的 plainText，生成结构化大纲
- **盲点分析**：基于笔记内容，对比该领域的知识全景，指出未覆盖的部分
- **复习题**：根据笔记内容生成 5-10 道问答题，附参考答案
- **问 AI**：聊天式问答，自动注入该主题下笔记作为上下文

所有 AI 生成结果存入 `learningReviews` 表，可在历史记录中查看。

---

## 板块二：开源项目

### 核心交互

- 按**项目**组织（如「gin」「moby」）
- 每个项目关联一个 GitHub URL 作为元信息
- 项目下是自由的分析笔记，支持标签筛选
- 笔记内容来自用户在外部 AI 工具中获得的分析结果（复制粘贴）
- AI 角色轻量：自动建议标签、生成项目摘要

### 页面结构

#### 项目列表页 `/projects`

- 卡片列表展示所有项目
- 每张卡片显示：项目名、语言标签、简介、笔记数量、热门标签
- 「+ 添加项目」按钮

#### 项目详情页 `/projects/[id]`

- 顶部项目信息：名称、语言、GitHub 链接、描述
- 标签筛选栏（从该项目所有笔记的标签中提取）
- 笔记列表，每条显示标题、摘要、标签、日期
- 「+ 添加笔记」按钮
- 点击笔记进入 Tiptap 编辑器

### 数据模型

**`osProjects` 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text PK | UUID |
| userId | text FK → users NOT NULL | 用户 |
| name | text NOT NULL | 项目名（如「gin」） |
| repoUrl | text | GitHub URL |
| description | text | 项目简介 |
| language | text | 主要语言（Go/Rust/...） |
| aiSummary | text | AI 生成的项目总结 |
| createdAt | integer NOT NULL | 创建时间 |
| updatedAt | integer NOT NULL | 更新时间 |

**`osProjectNotes` 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text PK | UUID |
| projectId | text FK → osProjects NOT NULL | 所属项目 |
| userId | text FK → users NOT NULL | 用户 |
| title | text NOT NULL | 笔记标题 |
| content | text | Tiptap JSON 富文本内容 |
| plainText | text | 纯文本（搜索用） |
| tags | text | JSON 数组，标签 |
| createdAt | integer NOT NULL | 创建时间 |
| updatedAt | integer NOT NULL | 更新时间 |

---

## 导航变更

在 sidebar navigation 中添加两个入口：

```
Home          → /
Notes         → /notes
Learn         → /learn        (改造，原学习路径)
Projects      → /projects     (新增)
Focus         → /focus
Portfolio     → /portfolio
Ask AI        → /ask
Settings      → /settings
```

## 旧数据迁移

现有的 `learningPaths` 和 `learningLessons` 表保留但不再使用。新板块使用全新的表。如果后续确认旧表完全不需要，可以在未来版本中清理。

## 实现优先级

1. **P0 — 学习笔记本基础**：主题 CRUD、笔记 CRUD、Tiptap 编辑器集成
2. **P0 — 开源项目基础**：项目 CRUD、笔记 CRUD、标签筛选
3. **P1 — AI 起草笔记**：输入关键词 → AI 生成全面初稿
4. **P1 — 编辑器内 AI 辅助**：选中文本 → AI 扩展/简化/润色
5. **P2 — AI 助手 Tab**：知识大纲、盲点分析、复习题、问 AI
6. **P2 — AI 标签建议**：开源项目笔记的自动标签推荐

## 测试策略

- E2E 测试覆盖两个板块的核心 CRUD 流程
- 学习板块：创建主题 → 创建笔记 → 编辑 → 删除
- 开源项目：创建项目 → 添加笔记 → 标签筛选 → 删除
- AI 功能：mock API 测试起草和生成流程
