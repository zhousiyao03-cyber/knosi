// src/server/db/schema/billing.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    lsSubscriptionId: text("ls_subscription_id").notNull().unique(),
    lsCustomerId: text("ls_customer_id").notNull(),
    lsVariantId: text("ls_variant_id").notNull(),
    plan: text("plan").notNull().default("pro"),
    status: text("status", {
      enum: ["on_trial", "active", "past_due", "cancelled", "expired", "paused"],
    }).notNull(),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    renewsAt: integer("renews_at", { mode: "timestamp" }),
    updateUrl: text("update_url"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => [index("subscriptions_status_idx").on(table.status)],
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),             // LS event id
    eventName: text("event_name").notNull(),
    payload: text("payload").notNull(),      // JSON string
    signature: text("signature"),
    receivedAt: integer("received_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    processedAt: integer("processed_at", { mode: "timestamp" }),
    error: text("error"),
  },
  (table) => [index("webhook_events_received_idx").on(table.receivedAt)],
);
