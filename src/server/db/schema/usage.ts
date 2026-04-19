import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const tokenUsageEntries = sqliteTable(
  "token_usage_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["codex", "claude-code", "openai-api", "other"] }).notNull(),
    model: text("model"),
    totalTokens: integer("total_tokens").notNull(),
    inputTokens: integer("input_tokens").default(0),
    outputTokens: integer("output_tokens").default(0),
    cachedTokens: integer("cached_tokens").default(0),
    notes: text("notes"),
    source: text("source", { enum: ["manual", "import"] }).notNull().default("manual"),
    usageAt: integer("usage_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("token_usage_entries_user_idx").on(table.userId, table.usageAt)]
);

export const usageRecords = sqliteTable(
  "usage_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // "YYYY-MM-DD"
    provider: text("provider").notNull(), // "claude-code" | "codex"
    model: text("model").notNull().default(""),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("usage_records_user_date_provider_model_idx").on(
      table.userId,
      table.date,
      table.provider,
      table.model,
    ),
  ],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // 'YYYY-MM-DD'
    count: integer("count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("ai_usage_user_date_idx").on(table.userId, table.date),
  ]
);
