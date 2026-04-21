#!/usr/bin/env node
/**
 * Emit a gauge-style snapshot of subscriptions grouped by status.
 *
 * Intended to be run from cron every ~15 minutes. Writes one line per
 * status to stdout in the form:
 *
 *   billing.subscription.state status=<status> count=<n>
 *
 * Downstream collectors (Promtail / node_exporter textfile / etc.) can
 * tail this output. The process does not hit the Next.js runtime — it
 * talks to libsql directly so it can run inside a lightweight container
 * or straight from the host.
 *
 * Env:
 *   TURSO_DATABASE_URL   libsql URL (defaults to local file:data/second-brain.db)
 *   TURSO_AUTH_TOKEN     auth token for Turso; omitted for local file DB
 *
 * Usage:
 *   # Local:
 *   node scripts/billing/emit-subscription-gauge.mjs
 *
 *   # Production Turso:
 *   set -a && source .env.turso-prod.local && set +a \
 *     && node scripts/billing/emit-subscription-gauge.mjs
 */

import path from "node:path";
import { createClient } from "@libsql/client";

const DEFAULT_SQLITE_DB_PATH = path.join("data", "second-brain.db");
const dbUrl = process.env.TURSO_DATABASE_URL ?? `file:${DEFAULT_SQLITE_DB_PATH}`;

const client = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const result = await client.execute(
    "SELECT status, COUNT(*) AS count FROM subscriptions GROUP BY status",
  );

  // Known statuses — emit a zero line even when empty so dashboards don't
  // flatline on transient "no rows for this status" queries.
  const seen = new Map();
  for (const row of result.rows) {
    seen.set(String(row.status), Number(row.count));
  }
  const knownStatuses = [
    "on_trial",
    "active",
    "past_due",
    "cancelled",
    "expired",
    "paused",
  ];
  for (const status of knownStatuses) {
    const count = seen.get(status) ?? 0;
    console.log(`billing.subscription.state status=${status} count=${count}`);
  }

  client.close();
}

main().catch((err) => {
  console.error("[emit-subscription-gauge] failed:", err);
  process.exit(1);
});
