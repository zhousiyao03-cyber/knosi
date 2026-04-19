import { sqliteTable, text, integer, blob, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const knowledgeChunks = sqliteTable(
  "knowledge_chunks",
  {
    id: text("id").primaryKey(),
    // Nullable for backward compat with rows written before the security
    // rollout; a one-shot backfill script copies userId from the owning
    // note/bookmark. New writes always set this.
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    sourceType: text("source_type", { enum: ["note", "bookmark"] }).notNull(),
    sourceId: text("source_id").notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp" }),
    chunkIndex: integer("chunk_index").notNull(),
    sectionPath: text("section_path"), // JSON array
    blockType: text("block_type"),
    text: text("text").notNull(),
    textHash: text("text_hash").notNull(),
    tokenCount: integer("token_count"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => [
    index("knowledge_chunks_user_id_idx").on(table.userId),
    index("knowledge_chunks_source_idx").on(table.sourceId),
  ]
);

export const knowledgeChunkEmbeddings = sqliteTable("knowledge_chunk_embeddings", {
  chunkId: text("chunk_id")
    .primaryKey()
    .references(() => knowledgeChunks.id),
  model: text("model").notNull(),
  dims: integer("dims").notNull(),
  vector: blob("vector", { mode: "buffer" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const knowledgeIndexJobs = sqliteTable(
  "knowledge_index_jobs",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type", { enum: ["note", "bookmark"] }).notNull(),
    sourceId: text("source_id").notNull(),
    reason: text("reason"),
    status: text("status", { enum: ["pending", "running", "done", "failed"] })
      .notNull()
      .default("pending"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(1),
    queuedAt: integer("queued_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
  },
  (table) => [
    index("knowledge_index_jobs_source_idx").on(table.sourceId),
    index("knowledge_index_jobs_status_idx").on(table.status),
    // B1-5: covers the claimNextJob hot path — WHERE status='pending'
    // AND queued_at <= ? ORDER BY queued_at ASC. Equality-first
    // (status), range+sort-last (queued_at). Replaces the TEMP B-TREE
    // FOR ORDER BY step that showed up in the B1-4 audit.
    index("knowledge_index_jobs_status_queued_idx").on(
      table.status,
      table.queuedAt
    ),
  ]
);
