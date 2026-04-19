import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const workflows = sqliteTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    nodes: text("nodes"), // JSON, workflow node definitions
    edges: text("edges"), // JSON, node connections
    status: text("status", { enum: ["draft", "active"] }).default("draft"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("workflows_user_idx").on(table.userId)]
);

export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").references(() => workflows.id),
    status: text("status", { enum: ["running", "completed", "failed"] }).default("running"),
    results: text("results"), // JSON, per-node results
    startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [index("workflow_runs_workflow_idx").on(table.workflowId)]
);
