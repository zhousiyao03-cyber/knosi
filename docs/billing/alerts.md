# Billing Alerts

Thresholds and response plans for the billing-subsystem metrics emitted by
`src/server/metrics.ts` (`recordBillingEvent` / `setBillingGauge`). The
metrics themselves are defined in `docs/superpowers/plans/2026-04-20-billing.md`
§9.1 and wired up in Task 34.

This file is documentation only — the alert-routing pipeline (PagerDuty,
Slack webhook, Grafana alert rules) is out of scope for this task and
belongs to the staging rollout (Task 38).

## Catalog

| Metric | Type | Labels |
|---|---|---|
| `billing.webhook.received` | counter | `event_name` |
| `billing.webhook.processed` | counter | `event_name`, `status=success\|duplicate\|error` |
| `billing.checkout.started` | counter | `variant=monthly\|annual` |
| `billing.checkout.completed` | counter | `variant` (LS variant id) |
| `billing.quota_exceeded` | counter | `resource=notes\|storageMB\|shareLinks` |
| `billing.ai.upstream_error` | counter | `account`, `status` (HTTP status or `unknown`) |
| `billing.ai.upstream_success` | counter | `account` |
| `billing.entitlement.cache` | counter | `result=hit\|miss\|parse_error` |
| `billing.subscription.state` | gauge | `status` (on_trial / active / past_due / ...) |

The first eight live in the Next.js process memory and are exposed via
`snapshotMetrics()` (scraped through `/api/ops/snapshot`). The gauge is
written by `scripts/billing/emit-subscription-gauge.mjs` run from host cron.

## Alert rules

### 1. Webhook processing failure

**Condition:** `rate(billing.webhook.processed{status="error"}[5m]) > 0`
for more than two consecutive minutes.

**Response:**
1. Check `/api/ops/snapshot` for the failing `event_name`.
2. Inspect `webhook_events` rows whose `error` column is non-null since
   the alert fired.
3. If the failure is isolated to a single event id, retry once via the
   Lemon Squeezy dashboard (Resend webhook). If the retry also fails, open
   an incident — billing state is diverging from LS.

### 2. Hosted AI account throttled

**Condition:**
`sum by (account) (rate(billing.ai.upstream_error{status="429"}[5m])) > 10`

i.e. more than 10 upstream 429s from a single pool account in five
minutes.

**Response:**
1. Rotate that account out of `KNOSI_CODEX_ACCOUNT_POOL` immediately.
2. Deploy the env change (restart the deployment to pick up new pool).
3. File a note against the account in the ops log — Codex ToS risk, we
   want a trend over time.

### 3. Anomalous per-user spend

**Condition:** A single user's estimated daily spend > USD 2.

Spend is not directly exposed as a metric — it is derived by joining
`billing.ai.upstream_success{account}` counts against the known per-call
cost for that pool account, bucketed by `userId` at the application
layer. The `runWithHostedAi` logger already emits `account` per call; the
app-side structured logs are the source of truth.

**Response:**
1. Confirm the spike is real (not a single batch import).
2. If the user is on the free trial, consider lowering their
   `askAiPerDay` cap temporarily via a support flag.
3. If abuse, revoke pro status and notify the user.

### 4. Runaway quota denials

**Condition:** `rate(billing.quota_exceeded{resource="notes"}[1h]) > 50`

A sudden surge in quota denials usually means the app started double-
counting on the create path — or a single user is script-spamming.

**Response:**
1. Check which user ids are hitting the denial (logs carry the user id;
   the metric does not).
2. If isolated to one user, check their `notes` count against the
   `FREE_HOSTED_LIMITS.notes` cap. If the count is clearly below the cap,
   this is a counting bug — page.
3. If spread across users, roll back the most recent deploy that touched
   `assertQuota` call sites.

### 5. Entitlement cache degradation

**Condition:** `rate(billing.entitlement.cache{result="parse_error"}[5m]) > 0`

We should never see this — `invalidateEntitlements` wipes the key on any
mutation. If it fires, someone wrote a non-JSON blob into the cache
manually or the schema changed without a migration.

**Response:**
1. `redis-cli KEYS "billing:ent:*" | xargs redis-cli DEL` to nuke the
   cache.
2. Check the git log for recent `Entitlements` type changes.

### 6. Subscription state stuck in `past_due`

**Condition:** `billing.subscription.state{status="past_due"}` > 5% of
total subscriptions.

Derived at query time as
`past_due / sum(billing.subscription.state) > 0.05`.

**Response:**
1. Run a report of past_due subs older than 7 days.
2. Confirm LS is still sending `subscription_payment_recovered` /
   `subscription_cancelled` — if the webhook endpoint is broken we'll see
   a corresponding rise in `billing.webhook.processed{status="error"}`.

## Response ownership

During the pre-launch phase, the author owns all alert response. Once the
Pro tier has >50 paying subscribers, split responsibility:

- Billing webhook failures → on-call
- AI account throttling → AI platform owner
- Quota denial surges → product owner
