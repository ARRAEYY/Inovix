# Nosh — Cron Jobs

> Spec ref: §4 entity #19 (AuditLog), §3.2 Layer 1 (RefreshToken), §4 entity #13 (`pickupTimeoutMins`), §8.6 (no-show)
> Status: Implemented (`apps/backend/src/lib/cron.js` + `apps/backend/src/lib/reconciliation.js`)

## 1. Jobs

| Name               | Schedule              | Purpose                                                                 |
|--------------------|-----------------------|-------------------------------------------------------------------------|
| `audit-purge`       | Daily at 03:00        | Delete `AuditLog` rows older than `AUDIT_LOG_RETENTION_DAYS` (default 90) |
| `refresh-purge`     | Daily at 03:00        | Delete `RefreshToken` rows where `expiresAt < now - 30 days`; mark tokens past expiry as revoked |
| `cart-purge`        | Daily at 03:00        | Delete `Cart` rows past their `expiresAt` (CartItem rows cascade-delete) |
| `pickup-timeout`    | Every 5 minutes       | Auto-transition `READY` → `CANCELLED` after `pickupTimeoutMins` (no refund, no-show per §8.6). Calls `performTransition()` (atomic with audit + notification). |
| `refund-outbox`     | Every 2 minutes       | Process PENDING refunds with `gatewayRef=NULL` (never sent to gateway). Calls `processRefundAfterCommit()`. |
| `sentinel-cleanup`  | Every 10 minutes      | Reset stuck `in-progress-*` + `refund-in-progress-*` sentinels. For order sentinels, tries to recover the real gateway order by receipt. |
| `reconcile-refunds` | Every 10 minutes      | Poll Razorpay for the status of PENDING refunds that HAVE a `gatewayRef`. Updates COMPLETED/FAILED. Also handles `gatewayRef=NULL` via fallback (payment_id + amount match). |
| `reconcile-payments`| Every 10 minutes      | Poll Razorpay for stale PENDING payments (missed `payment.captured`/`payment.failed` webhooks). Fetches the order's actual captured payment (not the order ID). |

All jobs are wrapped in `runCronJob()` which:
1. Acquires a Postgres advisory lock (`pg_try_advisory_xact_lock`) — multi-instance safe. SQLite dev = no-op.
2. Catches + logs errors — never crashes the scheduler.
3. Logs "skipped" if another instance holds the lock.

All state-changing actions write `AuditLog` rows.

## 2. Job details

### 2.1 Audit log retention (spec §14 decision 8)

> "90 days rolling (DB cleanup cron). Sufficient for incident investigation, keeps DB small."

### 2.2 Refresh token purge (spec §3.2 Layer 1)

Refresh tokens are 7-day TTL. After rotation, the old row stays for theft detection (`replacedBy` chain). After 30 days, those chains are safe to delete.

### 2.3 Expired cart cleanup

Cart rows past their `expiresAt` are dead (the cart service already filters them out). This job deletes the rows so the DB stays clean.

### 2.4 Pickup timeout (spec §4 entity #13 + §8.6)

> `pickupTimeoutMins` controls the READY → CANCELLED no-show window per §8.6.

When an outlet marks an order `READY`, the student has `pickupTimeoutMins` (default 30) to collect it. After that window:

1. Finds READY orders via DB-level pre-filter (`readyAt < now - min(per-outlet pickupTimeoutMins)`)
2. Calls `performTransition()` — atomic with audit log + notification
3. No refund (no-show per spec §8.6; `REFUND_TRIGGERS.READY_TO_CANCELLED = null`)
4. Emits `order:status:changed` socket events

### 2.5 Refund outbox worker

The "outbox pattern" creates a Refund row with `status=PENDING` inside the order-transition transaction. The controller calls `processRefundAfterCommit()` post-commit. If the server crashes between the tx commit and the post-commit call, the Refund stays PENDING with `gatewayRef=NULL`.

This worker picks up orphaned refunds (`PENDING + gatewayRef=NULL + age > OUTBOX_MIN_AGE_MINS`) and retries the gateway call automatically. The `gatewayRef` guard in `processRefundAfterCommit` prevents duplicate gateway calls if the controller already succeeded.

### 2.6 Stale sentinel cleanup

When `createRazorpayOrder()` or `processRefundAfterCommit()` sets a sentinel (`in-progress-*` or `refund-in-progress-*`) to claim a row, the sentinel must be cleared on success or failure. If the process crashes between the claim and the cleanup, the sentinel stays forever.

This cleanup finds stale sentinels (older than `SENTINEL_STALE_MINS`):
- **Order sentinels** (`in-progress-*`): tries to recover by fetching the Razorpay order by receipt (`orderNumber`). If found → the gateway call succeeded but the DB update failed → store the real ID. If not found → reset to NULL.
- **Refund sentinels** (`refund-in-progress-*`): reset to NULL so the outbox worker can retry.

### 2.7 Refund reconciliation

Polls Razorpay for the STATUS of PENDING refunds that HAVE a `gatewayRef` (the gateway call succeeded, but the webhook was missed or the refund is still processing). Also handles `gatewayRef=NULL` via fallback (match by `payment_id + amount + PENDING`).

Maps gateway status: `processed` → `COMPLETED`, `failed` → `FAILED`, `created`/`pending` → stays `PENDING`. Calls `markPaymentRefundedIfFullyRefunded` when a refund reaches COMPLETED.

### 2.8 Payment reconciliation

Polls Razorpay for stale PENDING payments (missed `payment.captured`/`payment.failed` webhooks). Fetches the gateway order → if `amount_paid >= expected`, fetches the order's actual captured payment (NOT the order ID) and stores the real `pay_xxx` as `razorpayPaymentId`. If the gateway order has had too many failed attempts (`>= PAYMENT_MAX_ATTEMPTS`), marks the payment FAILED.

## 3. Configuration

### Env vars (in `.env`)

```
RUN_CRON=true                              # set to "false" to disable all jobs
AUDIT_LOG_RETENTION_DAYS=90
PICKUP_TIMEOUT_MINS=30

# Reconciliation + outbox worker
OUTBOX_INTERVAL_MINS=2                     # outbox worker cron interval
OUTBOX_MIN_AGE_MINS=2                      # grace period before a PENDING refund is eligible for outbox
SENTINEL_STALE_MINS=5                      # stale sentinel cleanup threshold
RECONCILIATION_INTERVAL_MINS=10            # reconciliation worker cron interval
RECONCILIATION_MIN_AGE_MINS=5              # min age before a PENDING refund is eligible for reconciliation
PAYMENT_RECONCILIATION_MIN_AGE_MINS=30     # min age before a PENDING payment is considered stale
PAYMENT_MAX_ATTEMPTS=5                     # max failed gateway attempts before marking payment FAILED
```

## 4. Multi-instance deployment

All cron jobs are wrapped in `runCronJob()` which acquires a Postgres advisory lock (`pg_try_advisory_xact_lock`) before running. On SQLite (dev), the lock is a no-op (single-instance assumption). On Postgres (production), only one instance runs each job per interval — the others log "skipped" and exit.

No Redis required — the advisory lock is built into Postgres.

## 5. Manual triggers (for debugging)

```js
const {
  purgeAuditLogs,
  purgeExpiredRefreshTokens,
  purgeExpiredCarts,
  processPickupTimeouts,
  processPendingRefundOutbox,
  cleanupStaleSentinels,
  reconcilePendingRefunds,
  reconcileStalePendingPayments,
} = require('./src/lib/cron');

(async () => {
  await purgeAuditLogs();
  await processPickupTimeouts();
  await processPendingRefundOutbox();
  await reconcilePendingRefunds();
  process.exit(0);
})();
```

## 6. Logs

```
[cron:audit-purge] deleted 47 audit log rows older than 90 days
[cron:pickup-timeout] cancelled 2 READY orders past their pickup window (scanned 3 candidates)
[cron:refund-outbox] processed 1 orphaned PENDING refunds, 0 failed (scanned 1)
[cron:sentinel-cleanup] recovered 0, reset 1 stale sentinels
[cron:reconcile-refunds] reconciled 1 PENDING refunds, 0 still pending at gateway (scanned 1)
[cron:reconcile-payments] reconciled 1 stale PENDING payments, 0 still legitimately pending (scanned 2)
[cron:reconcile-refunds] skipped — another instance holds the advisory lock
```
