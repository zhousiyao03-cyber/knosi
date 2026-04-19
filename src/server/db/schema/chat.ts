import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    sources: text("sources"), // JSON, referenced doc IDs
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("chat_messages_user_idx").on(table.userId)]
);

// ── Ask AI Daemon Queue ────────────────────────────
// daemonChatMessages is prefixed to avoid colliding with the legacy v1
// `chatMessages` conversation table above. Different shape,
// different purpose — both are retained.

export const chatTasks = sqliteTable(
  "chat_tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("queued"),
    taskType: text("task_type", { enum: ["chat", "structured"] })
      .notNull()
      .default("chat"),
    sourceScope: text("source_scope").notNull().default("all"), // "all" | "notes" | "bookmarks" | "direct" — see src/lib/ask-ai.ts#ASK_AI_SOURCE_SCOPES
    messages: text("messages").notNull(), // JSON-encoded ModelMessage[]
    systemPrompt: text("system_prompt").notNull(),
    model: text("model").notNull().default("opus"), // Claude CLI model alias: "opus" | "sonnet" | "haiku" (or full ID)
    totalText: text("total_text"),
    structuredResult: text("structured_result"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => ({
    statusCreatedAtIdx: index("chat_tasks_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id
    ),
  })
);

export const daemonChatMessages = sqliteTable(
  "daemon_chat_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => chatTasks.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type", { enum: ["text_delta", "text_final", "error"] }).notNull(),
    delta: text("delta"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    taskSeqIdx: uniqueIndex("daemon_chat_messages_task_seq_idx").on(table.taskId, table.seq),
  })
);
