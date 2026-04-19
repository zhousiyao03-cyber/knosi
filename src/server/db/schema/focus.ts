import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const activitySessions = sqliteTable(
  "activity_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceDeviceId: text("source_device_id").notNull(),
    sourceSessionId: text("source_session_id").notNull(),
    appName: text("app_name").notNull(),
    windowTitle: text("window_title"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }).notNull(),
    durationSecs: integer("duration_secs").notNull(),
    tags: text("tags"),
    browserUrl: text("browser_url"),
    browserPageTitle: text("browser_page_title"),
    browserHost: text("browser_host"),
    browserPath: text("browser_path"),
    browserSearchQuery: text("browser_search_query"),
    browserSurfaceType: text("browser_surface_type"),
    visibleApps: text("visible_apps"),
    aiSummary: text("ai_summary"),
    ingestionStatus: text("ingestion_status", {
      enum: ["pending", "processed", "failed"],
    })
      .notNull()
      .default("pending"),
    ingestedAt: integer("ingested_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("activity_sessions_user_device_source_idx").on(
      table.userId,
      table.sourceDeviceId,
      table.sourceSessionId
    ),
    index("activity_sessions_user_started_idx").on(
      table.userId,
      table.startedAt
    ),
  ]
);

export const focusDailySummaries = sqliteTable(
  "focus_daily_summaries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    timezone: text("timezone").notNull(),
    totalFocusSecs: integer("total_focus_secs").notNull().default(0),
    tagBreakdown: text("tag_breakdown"),
    aiAnalysis: text("ai_analysis"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp" }),
    generatedAt: integer("generated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("focus_daily_user_date_idx").on(table.userId, table.date)]
);

export const focusDevices = sqliteTable(
  "focus_devices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPreview: text("token_preview").notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("focus_devices_user_device_idx").on(table.userId, table.deviceId),
    uniqueIndex("focus_devices_token_hash_idx").on(table.tokenHash),
  ]
);

export const focusDevicePairings = sqliteTable(
  "focus_device_pairings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    codePreview: text("code_preview").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp" }),
    pairedDeviceId: text("paired_device_id"),
    pairedDeviceName: text("paired_device_name"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("focus_device_pairings_code_hash_idx").on(table.codeHash),
  ]
);

export const focusPairingRateLimits = sqliteTable(
  "focus_pairing_rate_limits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    count: integer("count").notNull().default(0),
    windowStart: integer("window_start", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("focus_pairing_rate_limits_scope_key_idx").on(table.scope, table.key)]
);
