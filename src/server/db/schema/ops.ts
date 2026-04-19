import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const daemonHeartbeats = sqliteTable("daemon_heartbeats", {
  kind: text("kind").primaryKey(), // "chat" | "analysis" | "usage"
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
  version: text("version"),
});

export const opsJobHeartbeats = sqliteTable("ops_job_heartbeats", {
  jobName: text("job_name").primaryKey(),
  lastStatus: text("last_status", { enum: ["healthy", "degraded"] }).notNull(),
  lastSuccessAt: integer("last_success_at", { mode: "timestamp" }),
  lastFailureAt: integer("last_failure_at", { mode: "timestamp" }),
  lastMessage: text("last_message"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── CLI Auth Tokens ──────────────────────────────
// Each user's local CLI daemon authenticates with a personal token.
// Tokens are generated via the web UI and stored locally by the CLI.

export const cliTokens = sqliteTable(
  "cli_tokens",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    name: text("name").notNull().default("CLI Daemon"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("cli_tokens_hash_idx").on(table.tokenHash),
    index("cli_tokens_user_idx").on(table.userId),
  ]
);
