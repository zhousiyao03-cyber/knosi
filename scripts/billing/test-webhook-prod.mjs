// Same as test-webhook-prod but uses curl for HTTP (Node's undici prefers IPv6
// which some dev networks can't reach).
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@libsql/client";
import fs from "node:fs";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const storeId = Number(process.env.LEMONSQUEEZY_STORE_ID);
const variantId = Number(process.env.LEMONSQUEEZY_VARIANT_MONTHLY);

const { rows: [owner] } = await db.execute({
  sql: "SELECT id, email FROM users WHERE email=? LIMIT 1",
  args: ["zhousiyao03@gmail.com"],
});
const userId = owner.id;
console.log("targeting user:", userId);
await db.execute({ sql: "DELETE FROM subscriptions WHERE user_id=?", args: [userId] });

const eventId = `prod-smoke-${Date.now()}`;
const payload = {
  meta: { event_name: "subscription_created", event_id: eventId, custom_data: { user_id: userId } },
  data: {
    type: "subscriptions",
    id: `sub-smoke-${Date.now()}`,
    attributes: {
      store_id: storeId, customer_id: 987654, order_id: 111111,
      variant_id: variantId, status: "active",
      trial_ends_at: null,
      renews_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      ends_at: null,
      urls: { update_payment_method: "https://knosi-ai.lemonsqueezy.com/billing?sub=smoke", customer_portal: "https://knosi-ai.lemonsqueezy.com/billing" },
    },
  },
};
const raw = JSON.stringify(payload);
const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");

const tmp = `${process.env.TMP || process.env.TMPDIR || "/tmp"}/wh-${Date.now()}.json`;
fs.writeFileSync(tmp, raw);
const out = execFileSync("curl", [
  "-4", "-sS",
  "-X", "POST",
  "-H", "content-type: application/json",
  "-H", `x-signature: ${sig}`,
  "--data-binary", `@${tmp}`,
  "-w", "\nHTTP: %{http_code}",
  "https://www.knosi.xyz/api/webhooks/lemon-squeezy",
], { encoding: "utf8" });
fs.unlinkSync(tmp);
console.log("webhook response:", out);

console.log("\nDB state after:");
const wh = await db.execute({ sql: "SELECT id, event_name, processed_at, error FROM webhook_events WHERE id=?", args: [eventId] });
console.log("  webhook_events:", wh.rows[0] ?? "MISSING");
const sub = await db.execute({ sql: "SELECT user_id, status, ls_subscription_id, current_period_end FROM subscriptions WHERE user_id=?", args: [userId] });
console.log("  subscriptions:", sub.rows[0] ?? "MISSING");

// Cleanup.
await db.execute({ sql: "DELETE FROM subscriptions WHERE user_id=?", args: [userId] });
await db.execute({ sql: "DELETE FROM webhook_events WHERE id=?", args: [eventId] });
console.log("cleaned up test rows");
