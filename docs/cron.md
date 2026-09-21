# Nosh — Cron Jobs

> Spec ref: §4 entity #19 (AuditLog), §3.2 Layer 1 (RefreshToken), §4 entity #13 (`pickupTimeoutMins`)
> Status: Implemented (`apps/backend/src/lib/cron.js`)

## 1. Jobs

| Name             | Schedule              | Purpose                                                |
|------------------|-----------------------|--------------------------------------------------------|
| `audit-purge`     | Daily at 03:00        | Delete `AuditLog` rows older than `AUDIT_LOG_RETENTION_DAYS` (default 90) |
| `refresh-purge`   | Daily at 03:00        | Delete `RefreshToken` rows where `expiresAt < now - 30 days`; mark tokens past expiry as revoked |
| `pickup-timeout`  | Every 5 minutes       | Auto-transition `READY` orders to `COMPLETED` after the outlet's `pickupTimeoutMins` (default 30 min) |

All jobs log to stdout on completion (only if they actually did work) and write `AuditLog` rows for state-changing operations.

## 2. Why these three

### 2.1 Audit log retention (spec §14 decision 8)

> "90 days rolling (DB cleanup cron). Sufficient for incident investigation, keeps DB small."

Without this, the AuditLog table grows unbounded — every state-changing outlet/admin op writes a row. At 50 ops/day across 4 outlets, that's ~18,000 rows/year — manageable, but a 90-day window keeps it tight.

### 2.2 Refresh token purge (spec §3.2 Layer 1)

Refresh tokens are 7-day TTL. After rotation, the old row stays around for theft detection (the `replacedBy` chain). After 30 days, those chains are stale and safe to delete. Also marks tokens that hit their 7-day expiry without logout as `revokedAt = now` — keeps the DB clean and prevents weird edge cases in the rotation logic.

### 2.3 Pickup timeout (spec §4 entity #13 + §8.6)

> "`pickupTimeoutMins` controls the READY → CANCELLED no-show window per §8.6."

When an outlet marks an order `READY`, the student has `pickupTimeoutMins` (default 30) to collect it. After that window elapses, the cron:

1. Finds all `Order` rows with `status === 'READY'`
2. Checks each one's `outlet.pickupTimeoutMins` against `order.readyAt`
3. Auto-transitions past-due orders to `COMPLETED` (the food was made and either picked up or wasted — the outlet doesn't need to babysit the dashboard)
4. Appends an entry to `Order.timeline` with `by: 'cron:pickup-timeout'`
5. Creates a `Notification` (`ORDER_COMPLETED` with reason `pickup_timeout`) for the student
6. Writes an `AuditLog` (`ORDER_PICKUP_TIMEOUT`)
7. Emits `order:status:changed` to both `outlet:<id>` and `student:<id>` Socket.IO rooms

> Note: the current implementation uses `COMPLETED` as the auto-terminal state, not `CANCELLED`. The spec §8.6 says `READY → CANCELLED` is the no-show case (no refund). If you prefer the spec-literal behavior, change the `processPickupTimeouts()` function to set `CANCELLED` instead of `COMPLETED`. The reason for our choice: at pickup-timeout, we don't know if the student picked up (food gone) or no-showed (food wasted). `COMPLETED` is the conservative default; if the outlet wants to record a no-show refund-exempt case, they can manually mark `CANCELLED` before the timeout fires.

## 3. Configuration

### Env vars (in `.env`)

```
RUN_CRON=true                              # set to "false" to disable all jobs (e.g. in tests)
AUDIT_LOG_RETENTION_DAYS=90                # spec default
PICKUP_TIMEOUT_MINS=30                     # fallback if outlet.pickupTimeoutMins is null
```

### Per-outlet config

Each `Outlet` row has its own `pickupTimeoutMins` column (default 30). The super admin can change this via the planned `PATCH /api/v1/admin/outlets/:id` endpoint (outlet profile update — schema is ready, controller route is M2 stretch).

## 4. Multi-instance deployment warning

In a multi-instance deployment (Kubernetes with replicas > 1), **only one instance should run the cron jobs**. Otherwise:

- Audit rows may be deleted multiple times (idempotent — `deleteMany` is safe)
- Refresh tokens may be marked revoked multiple times (idempotent — `updateMany` is safe)
- **Pickup timeouts may transition the same order twice** → the second attempt will hit the `ALLOWED_TRANSITIONS[COMPLETED] = []` rule and throw `INVALID_TRANSITION`. The current code catches and logs this, but it's noisy.

For production multi-instance, use a distributed lock:

- **Redis SET NX EX**: acquire a 60-second lock before each job run; release on completion
- **Postgres advisory lock**: `SELECT pg_try_advisory_lock(<job-id>)` — works without Redis

For V1 single-instance (default deployment), the cron as-written is correct.

## 5. Manual triggers (for debugging)

The cron functions are exported so you can call them manually:

```js
// In a one-off script:
const { purgeAuditLogs, purgeExpiredRefreshTokens, processPickupTimeouts } = require('./src/lib/cron');

(async () => {
  await purgeAuditLogs();
  await purgeExpiredRefreshTokens();
  await processPickupTimeouts();
  process.exit(0);
})();
```

Or hit the (planned) admin endpoint:

```
POST /api/v1/admin/cron/run
  { job: "audit-purge" | "refresh-purge" | "pickup-timeout" }
```

(Endpoint not yet implemented — manual script for now.)

## 6. Graceful shutdown

The `server.js` registers SIGTERM + SIGINT handlers that call `stopCron()` — this stops the in-flight schedule and lets any currently-running job finish before the process exits. If a job is mid-DB-write when the process exits, the next run will pick it up idempotently.

## 7. Logs

When a job runs and does work, it logs to stdout:

```
[cron:audit-purge] deleted 47 audit log rows older than 90 days
[cron:refresh-purge] deleted 12 old refresh tokens, marked 3 expired-as-revoked
[cron:pickup-timeout] auto-completed 2 READY orders past their pickup window
```

When a job runs and does nothing, it logs nothing (quiet).

When a job throws, it logs to stderr:

```
[cron:pickup-timeout] failed: <error message>
```

The job is NOT taken out of rotation — the next scheduled run will try again.
