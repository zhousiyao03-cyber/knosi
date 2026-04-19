import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

// ── Folders (hierarchical) ─────────────────────────
export const folders = sqliteTable(
  "folders",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: text("parent_id"), // self-reference for nesting
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("folders_user_idx").on(table.userId),
    index("folders_parent_idx").on(table.parentId),
  ]
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content"), // JSON, Tiptap format
    plainText: text("plain_text"), // for search & vectorization
    type: text("type", { enum: ["note", "journal", "summary"] }).default("note"),
    icon: text("icon"),
    cover: text("cover"),
    tags: text("tags"), // JSON array
    folder: text("folder"), // legacy flat grouping (kept for compat)
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    shareToken: text("share_token").unique(),
    sharedAt: integer("shared_at", { mode: "timestamp" }),
    /**
     * 单调递增的内容版本号。每次经过 notes.update / notes.appendBlocks
     * 这两个"用户内容写入"路径时 +1。用途见 docs/learn-backend/phase-b1.md
     * B1-3 段落：
     *   1. 为未来的"编辑历史"功能留版本号入口
     *   2. 为 B9 事件溯源的 event id 做铺垫
     *   3. 故意不做 CAS 乐观锁 — 详细原因见同一份文档
     * enableShare / disableShare / 系统性 title normalize / folder 批量迁移
     * 都不递增这一列（它们不是"内容变更"）。
     */
    version: integer("version").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("notes_user_idx").on(table.userId),
    index("notes_user_folder_idx").on(table.userId, table.folder),
    index("notes_folder_id_idx").on(table.folderId),
    // B1-5: covers notes.list's default ORDER BY updated_at DESC,
    // removing the "TEMP B-TREE FOR ORDER BY" file-sort step.
    // Rule: equality-first (user_id), range/sort-last (updated_at).
    index("notes_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

// ── Note Links (bidirectional wiki-links) ──────────
export const noteLinks = sqliteTable(
  "note_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceNoteId: text("source_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    targetNoteId: text("target_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    targetTitle: text("target_title").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("note_links_source_idx").on(table.sourceNoteId),
    index("note_links_target_idx").on(table.targetNoteId),
    uniqueIndex("note_links_pair_idx").on(table.sourceNoteId, table.targetNoteId),
  ]
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url"),
    title: text("title"),
    content: text("content"),
    summary: text("summary"),
    tags: text("tags"), // JSON array
    source: text("source", { enum: ["url", "text", "lark"] }).default("url"),
    status: text("status", { enum: ["pending", "processed", "failed"] }).default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("bookmarks_user_idx").on(table.userId),
    // B1-5: covers bookmarks.list's default ORDER BY created_at DESC.
    index("bookmarks_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const todos = sqliteTable(
  "todos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority", { enum: ["low", "medium", "high"] }).default("medium"),
    status: text("status", { enum: ["todo", "in_progress", "done"] }).default("todo"),
    category: text("category"),
    dueDate: integer("due_date", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    index("todos_user_idx").on(table.userId),
    index("todos_user_duedate_status_idx").on(table.userId, table.dueDate, table.status),
    // B1-5: covers todos.list's default ORDER BY created_at DESC and
    // dashboard.pendingTodos which sorts on the same column.
    index("todos_user_created_idx").on(table.userId, table.createdAt),
  ]
);
