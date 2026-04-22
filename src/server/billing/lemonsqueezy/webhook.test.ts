// src/server/billing/lemonsqueezy/webhook.test.ts
import crypto from "node:crypto";
import path from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { users } from "@/server/db/schema/auth";
import { subscriptions, webhookEvents } from "@/server/db/schema/billing";

import cancelled from "./__fixtures__/subscription_cancelled.json";
import created from "./__fixtures__/subscription_created.json";
import paymentFailed from "./__fixtures__/subscription_payment_failed.json";
import { dispatchLsEvent } from "./handlers";
import { persistWebhookEvent, verifyLsSignature, type LsWebhookBody } from "./webhook";

const TEST_USER_ID = "user-abc";

function sign(body: string) {
  return crypto
    .createHmac("sha256", process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");
}

beforeAll(async () => {
  // Apply the full drizzle migration history to the in-memory libsql DB
  // so tables, indexes, and FK constraints match production.
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });

  // Seed the FK target row once — `subscriptions.user_id` references `users.id`.
  await db
    .insert(users)
    .values({ id: TEST_USER_ID, email: "user-abc@test.local" })
    .onConflictDoNothing();
});

beforeEach(async () => {
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "test-secret";
  await db.delete(webhookEvents);
  await db.delete(subscriptions);
});

describe("verifyLsSignature", () => {
  it("rejects a bad signature and accepts a valid one", () => {
    const raw = JSON.stringify(created);
    expect(verifyLsSignature(raw, "deadbeef")).toBe(false);
    expect(verifyLsSignature(raw, sign(raw))).toBe(true);
  });

  it("rejects when the secret is missing", () => {
    const raw = JSON.stringify(created);
    const original = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    try {
      expect(verifyLsSignature(raw, "anything")).toBe(false);
    } finally {
      process.env.LEMONSQUEEZY_WEBHOOK_SECRET = original;
    }
  });
});

describe("persistWebhookEvent", () => {
  it("records a new event on first call and rejects duplicates by event_id", async () => {
    const raw = JSON.stringify(created);
    const first = await persistWebhookEvent(created as LsWebhookBody, raw, sign(raw));
    const second = await persistWebhookEvent(created as LsWebhookBody, raw, sign(raw));
    expect(first.state).toBe("new");
    expect(second.state).toBe("duplicate");

    const rows = await db.select().from(webhookEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("evt-created-1");
  });
});

describe("dispatchLsEvent", () => {
  it("subscription_created inserts a row with status=on_trial", async () => {
    await dispatchLsEvent(created as LsWebhookBody);
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, TEST_USER_ID));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.status).toBe("on_trial");
    expect(row.lsSubscriptionId).toBe("ls-sub-1");
    expect(row.trialEndsAt).toBeInstanceOf(Date);
    expect(row.renewsAt).toBeInstanceOf(Date);
  });

  it("subscription_cancelled after created marks status=cancelled and sets cancelledAt", async () => {
    await dispatchLsEvent(created as LsWebhookBody);
    await dispatchLsEvent(cancelled as LsWebhookBody);
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, TEST_USER_ID));
    expect(row.status).toBe("cancelled");
    expect(row.cancelledAt).toBeInstanceOf(Date);
    // Row is preserved (same LS subscription id), not a fresh insert.
    expect(row.lsSubscriptionId).toBe("ls-sub-1");
  });

  it("subscription_payment_failed after created marks status=past_due", async () => {
    await dispatchLsEvent(created as LsWebhookBody);
    await dispatchLsEvent(paymentFailed as LsWebhookBody);
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, TEST_USER_ID));
    expect(row.status).toBe("past_due");
    expect(row.lsSubscriptionId).toBe("ls-sub-1");
  });
});
