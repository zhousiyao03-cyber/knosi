import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

// ── Open Source Projects ──────────────────────────

export const osProjects = sqliteTable(
  "os_projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    repoUrl: text("repo_url"),
    description: text("description"),
    language: text("language"),
    aiSummary: text("ai_summary"),
    // Source-code analysis fields
    analysisStatus: text("analysis_status"), // null | pending | analyzing | completed | failed
    analysisError: text("analysis_error"),
    // Snapshot of the repo at the time of the most recent successful analysis
    analysisCommit: text("analysis_commit"), // git rev-parse HEAD (full sha)
    analysisCommitDate: integer("analysis_commit_date", { mode: "timestamp" }), // commit author/committer date
    analysisStartedAt: integer("analysis_started_at", { mode: "timestamp" }),
    analysisFinishedAt: integer("analysis_finished_at", { mode: "timestamp" }),
    starsCount: integer("stars_count"),
    trendingDate: text("trending_date"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("os_projects_user_idx").on(table.userId)]
);

/**
 * User-customizable prompts for source code analysis.
 *
 * One row per (userId, kind). Falls back to baked-in defaults from
 * `src/server/ai/default-analysis-prompts.ts` when no row exists.
 */
export const analysisPrompts = sqliteTable(
  "analysis_prompts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["analysis", "followup"] }).notNull(),
    content: text("content").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userKindIdx: uniqueIndex("analysis_prompts_user_kind_idx").on(table.userId, table.kind),
  })
);

export const osProjectNotes = sqliteTable(
  "os_project_notes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => osProjects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content"),
    plainText: text("plain_text"),
    tags: text("tags"),
    shareToken: text("share_token").unique(),
    sharedAt: integer("shared_at", { mode: "timestamp" }),
    noteType: text("note_type").default("manual"), // manual | analysis | followup
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("os_project_notes_project_idx").on(table.projectId)]
);

export const analysisTasks = sqliteTable(
  "analysis_tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => osProjects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskType: text("task_type", { enum: ["analysis", "followup"] }).notNull(),
    status: text("status", { enum: ["queued", "running", "completed", "failed"] })
      .notNull()
      .default("queued"),
    provider: text("provider").notNull().default("claude"), // claude | codex | ...
    repoUrl: text("repo_url").notNull(),
    question: text("question"),
    originalAnalysis: text("original_analysis"),
    result: text("result"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("analysis_tasks_project_idx").on(table.projectId),
    index("analysis_tasks_status_idx").on(table.status, table.createdAt),
  ]
);

export const analysisMessages = sqliteTable(
  "analysis_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => analysisTasks.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type", { enum: ["tool_use", "tool_result", "text", "error"] }).notNull(),
    tool: text("tool"),
    summary: text("summary"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("analysis_messages_task_idx").on(table.taskId, table.seq)]
);
