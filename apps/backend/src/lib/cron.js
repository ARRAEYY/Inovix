/**
 * Cron jobs — runs on the same Node process as the Express server.
 *
 * Spec ref:
 *   - AuditLog retention: §14 decision 8 — 90 days rolling
 *   - RefreshToken purge: §3.2 Layer 1 — expired tokens older than 30d
 *   - READY → CANCELLED pickup timeout: §4 entity #13 `pickupTimeoutMins`
 *     (default 30 min) — spec §8.6 "READY → CANCELLED-after-pickup-timeout
 *     is a no-show case with NO refund"
 *
 * Deployment note: in a multi-instance setup, only ONE instance should run
 * these jobs. Use a distributed lock (Redis SET NX, Postgres advisory lock)
 * in production. For V1 single-instance, this file is fine.
 *
 * Env:
 *   - RUN_CRON (default: "true" in non-test) — set to "false" to disable
 *   - AUDIT_LOG_RETENTION_DAYS (default 90)
 *   - PICKUP_TIMEOUT_MINS (default 30) — used to compute the no-show window
 *
 * The jobs write AuditLog rows for state changes (READY→CANCELLED on pickup
 * timeout). The jobs themselves never throw — a failure in one job must
 * not crash the scheduler.
 */

const cron = require('node-cron');
const prisma = require('./prisma');
const { audit } = require('./audit');
const { ORDER_STATUS } = require('./constants');
const { runWithAdvisoryLock } = require('./distributedLock');
const { reconcilePendingRefunds, reconcileStalePendingPayments, processPendingRefundOutbox, cleanupStaleSentinels } = require('./reconciliation');

const REFRESH_TOKEN_PURGE_AGE_DAYS = 30;
const PICKUP_TIMEOUT_CHECK_INTERVAL = '*/5 * * * *'; // every 5 minutes
const DAILY_AT_3AM = '0 3 * * *';
// INO-AUDIT5: reconciliation worker interval (default 10 min).
// Polls Razorpay for PENDING refund + stale PENDING payment status.
const RECONCILIATION_INTERVAL_MINS = parseInt(process.env.RECONCILIATION_INTERVAL_MINS || '10', 10);
const RECONCILIATION_CRON = `*/${RECONCILIATION_INTERVAL_MINS} * * * *`;
// INO-AUDIT5-OUTBOX: outbox worker interval (default 2 min — more frequent
// than reconciliation because it processes NEW orphans, not stale ones).
// Processes PENDING refunds with gatewayRef=NULL (never sent to the gateway).
const OUTBOX_INTERVAL_MINS = parseInt(process.env.OUTBOX_INTERVAL_MINS || '2', 10);
const OUTBOX_CRON = `*/${OUTBOX_INTERVAL_MINS} * * * *`;

let scheduled = [];

function isCronEnabled() {
  const flag = (process.env.RUN_CRON ?? 'true').toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  if (process.env.NODE_ENV === 'test') return false;
  return true;
}

// ─── INO-P1-34 wrapper ─────────────────────────────────────────────────────
// Each cron job is wrapped in a Postgres transaction-scoped advisory lock
// so that a multi-instance deploy (e.g. 3 backend containers behind a
// load balancer) cannot run the same job on more than one instance at a
// time. On SQLite (dev) the lock is a no-op (single-instance assumption).
//
// The wrapper also catches and logs errors so a failing job doesn't crash
// the scheduler. If the lock is held by another instance, the wrapper
// logs a "skipped" message and exits 0 (no error).
async function runCronJob(jobName, fn) {
  try {
    const result = await runWithAdvisoryLock(`cron:${jobName}`, async () => {
      return fn();
    });
    if (result && result.skipped) {
      console.log(`[cron:${jobName}] skipped — another instance holds the advisory lock`);
    }
  } catch (e) {
    console.error(`[cron:${jobName}] failed:`, e.message);
  }
}

// ─── Job 1: Audit log purge ──────────────────────────────────────────────────
async function purgeAuditLogs() {
  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    console.log(`[cron:audit-purge] deleted ${result.count} audit log rows older than ${retentionDays} days`);
    await audit({
      actorId: null,
      action: 'CRON_AUDIT_PURGE',
      targetType: 'AuditLog',
      after: { deleted: result.count, cutoff: cutoff.toISOString() },
    });
  }
  return result.count;
}

// ─── Job 2: Refresh token purge ──────────────────────────────────────────────
async function purgeExpiredRefreshTokens() {
  const cutoff = new Date(Date.now() - REFRESH_TOKEN_PURGE_AGE_DAYS * 24 * 60 * 60 * 1000);

  // Delete already-revoked/expired refresh tokens older than 30 days
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });

  // Also auto-revoke stale ACTIVE refresh tokens that have expired but weren't
  // marked revoked (e.g., user never logged out). Mark them revoked so they
  // can't be rotated later via the refresh endpoint (which would return 401
  // for expired tokens anyway, but this keeps the DB clean).
  const expired = await prisma.refreshToken.updateMany({
    where: { expiresAt: { lt: new Date() }, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count > 0 || expired.count > 0) {
    console.log(`[cron:refresh-purge] deleted ${result.count} old refresh tokens, marked ${expired.count} expired-as-revoked`);
  }
  return { deleted: result.count, markedRevoked: expired.count };
}

// ─── Job 3: READY → CANCELLED pickup timeout (no-show) ───────────────────────
async function processPickupTimeouts() {
  // We use the per-outlet `pickupTimeoutMins` (default 30) — spec §4 entity #4.
  //
  // INO-P1-33 fix: previously this job loaded EVERY READY order in the DB
  // and skipped each one whose readyAt + pickupTimeoutMins > now in JS.
  // For a deployment with many active READY orders, that's a lot of rows
  // pulled across the wire every 5 minutes for nothing. Now we pre-filter
  // at the DB level using `min(per-outlet pickupTimeoutMins)`: any READY
  // order whose readyAt is newer than `now - minTimeoutMins` CANNOT be
  // past its pickup window yet, so it's excluded from the result set.
  // The per-outlet precision check still happens in JS for the candidates
  // that survive the DB filter (since different outlets can have different
  // timeouts, we can't push the full predicate to the DB without a JOIN
  // with per-row time math, which is awkward in Prisma).
  //
  // INO-AUDIT4-D8 fix: previously this job did `prisma.order.updateMany`
  // directly + manually created the notification + audit row afterward.
  // That bypassed performTransition() — the single transactional owner of
  // order status changes — so the cron transition wasn't atomic with the
  // audit + notification. If the process died between the updateMany and
  // the notification.create, the order was CANCELLED but the notification
  // was missing. Now we call performTransition() (which owns the atomic
  // order+audit+notification+refund-intent tx), then emit socket events
  // post-commit (consistent with the API controller path).
  const now = new Date();

  // Aggregate the minimum per-outlet pickupTimeoutMins across all outlets.
  // _min returns null if there are no outlets — fall back to env default.
  const minAgg = await prisma.outlet.aggregate({
    _min: { pickupTimeoutMins: true },
  });
  const globalMinTimeoutMins =
    minAgg._min?.pickupTimeoutMins ?? parseInt(process.env.PICKUP_TIMEOUT_MINS || '30', 10);

  const candidateCutoff = new Date(now.getTime() - globalMinTimeoutMins * 60 * 1000);

  const readyOrders = await prisma.order.findMany({
    where: {
      status: ORDER_STATUS.READY,
      readyAt: { lt: candidateCutoff },
    },
    include: { outlet: { select: { id: true, name: true, pickupTimeoutMins: true } } },
  });

  let completed = 0;
  for (const order of readyOrders) {
    if (!order.readyAt) continue;
    const timeoutMins = order.outlet?.pickupTimeoutMins ?? parseInt(process.env.PICKUP_TIMEOUT_MINS || '30', 10);
    const cutoff = new Date(order.readyAt.getTime() + timeoutMins * 60 * 1000);
    if (now < cutoff) continue; // still within this outlet's pickup window

    try {
      // Use the same transition service as the API path — atomic
      // order + audit + notification + (no refund for READY→CANCELLED
      // no-show per REFUND_TRIGGERS.READY_TO_CANCELLED = null).
      const { performTransition } = require('../modules/orders/transition.service');
      const result = await performTransition({
        orderId: order.id,
        expectedFromStatus: ORDER_STATUS.READY,
        toStatus: ORDER_STATUS.CANCELLED,
        actorId: null, // cron — no human actor
        reason: `Pickup window expired (${timeoutMins} min)`,
        // No triggerOverride — REFUND_TRIGGERS.READY_TO_CANCELLED is null,
        // so no refund is created. (Per spec §8.6 no-show = no refund.)
      });

      // Additional cron-specific audit row (separate from the
      // ORDER_STATUS_CHANGED row that performTransition wrote).
      await audit({
        actorId: null,
        action: 'ORDER_PICKUP_TIMEOUT',
        targetType: 'Order',
        targetId: order.id,
        before: { status: ORDER_STATUS.READY, readyAt: order.readyAt },
        after: { status: ORDER_STATUS.CANCELLED, timeoutMins },
      });

      completed++;
      // Emit a socket event so any open outlet dashboard / student tracking
      // page refreshes. (performTransition creates the notification row in
      // the tx; we emit the socket event here so connected clients see it.)
      try {
        const { emitOrderEvent, emitNotificationEvent } = require('./socket');
        emitOrderEvent('order:status:changed', `outlet:${order.outletId}`, {
          order: { id: order.id, status: ORDER_STATUS.CANCELLED, reason: 'pickup_timeout' },
        });
        emitOrderEvent('order:status:changed', `student:${order.studentId}`, {
          order: { id: order.id, status: ORDER_STATUS.CANCELLED, reason: 'pickup_timeout' },
        });
        if (result.notification) {
          emitNotificationEvent(order.studentId, result.notification);
        }
      } catch { /* socket not initialized */ }
    } catch (err) {
      // If performTransition threw (e.g. 409 because the order was
      // manually transitioned concurrently), skip silently — the order
      // is no longer READY so the timeout doesn't apply.
      if (err?.statusCode !== 409) {
        console.error(`[cron:pickup-timeout] order ${order.id} transition failed:`, err.message);
      }
    }
  }

  if (completed > 0) {
    console.log(`[cron:pickup-timeout] cancelled ${completed} READY orders past their pickup window (scanned ${readyOrders.length} candidates)`);
  }
  return completed;
}

// ─── Job 4: Expired cart cleanup (INO-AUDIT4-D20) ───────────────────────────
// Cart rows past their `expiresAt` are technically dead — the cart
// service's `findByStudent` already filters them out via
// `expiresAt: { gt: new Date() }`. But the rows themselves accumulate
// in the DB until manually cleaned. This job deletes them.
async function purgeExpiredCarts() {
  const result = await prisma.cart.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (result.count > 0) {
    console.log(`[cron:cart-purge] deleted ${result.count} expired cart rows`);
    // CartItem rows cascade-delete via the CartItem.cartId FK onDelete: Cascade.
  }
  return result.count;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initCron() {
  if (!isCronEnabled()) {
    console.log('[cron] disabled (RUN_CRON=false or NODE_ENV=test)');
    return;
  }

  scheduled = [
    cron.schedule(DAILY_AT_3AM, () => runCronJob('audit-purge', purgeAuditLogs), { name: 'audit-purge' }),
    cron.schedule(DAILY_AT_3AM, () => runCronJob('refresh-purge', purgeExpiredRefreshTokens), { name: 'refresh-purge' }),
    cron.schedule(DAILY_AT_3AM, () => runCronJob('cart-purge', purgeExpiredCarts), { name: 'cart-purge' }),
    cron.schedule(PICKUP_TIMEOUT_CHECK_INTERVAL, () => runCronJob('pickup-timeout', processPickupTimeouts), { name: 'pickup-timeout' }),
    // INO-AUDIT5: reconciliation worker — polls Razorpay for PENDING refund
    // + stale PENDING payment status (missed webhooks). Default every 10 min.
    cron.schedule(RECONCILIATION_CRON, () => runCronJob('reconcile-refunds', reconcilePendingRefunds), { name: 'reconcile-refunds' }),
    cron.schedule(RECONCILIATION_CRON, () => runCronJob('reconcile-payments', reconcileStalePendingPayments), { name: 'reconcile-payments' }),
    // INO-AUDIT5-OUTBOX: outbox worker — processes PENDING refunds with
    // gatewayRef=NULL (never sent to the gateway). More frequent than
    // reconciliation (default every 2 min) because it processes new
    // orphans, not stale ones.
    cron.schedule(OUTBOX_CRON, () => runCronJob('refund-outbox', processPendingRefundOutbox), { name: 'refund-outbox' }),
    // INO-AUDIT8-#3: stale sentinel cleanup — resets stuck "in-progress-*"
    // sentinels (order creation + refund processing) so they can be retried.
    cron.schedule(RECONCILIATION_CRON, () => runCronJob('sentinel-cleanup', cleanupStaleSentinels), { name: 'sentinel-cleanup' }),
  ];

  console.log(`[cron] scheduled: ${scheduled.map(s => s.name || '?').join(', ')}`);
  console.log(`[cron] audit purge: daily at 03:00 (${process.env.AUDIT_LOG_RETENTION_DAYS || 90}-day retention)`);
  console.log(`[cron] refresh purge: daily at 03:00 (delete tokens older than 30d)`);
  console.log(`[cron] cart purge: daily at 03:00 (delete carts past expiresAt)`);
  console.log(`[cron] pickup timeout: every 5 min (default window: ${process.env.PICKUP_TIMEOUT_MINS || 30} min)`);
  console.log(`[cron] refund outbox: every ${OUTBOX_INTERVAL_MINS} min (min age: ${process.env.OUTBOX_MIN_AGE_MINS || 2} min)`);
  console.log(`[cron] sentinel cleanup: every ${RECONCILIATION_INTERVAL_MINS} min (stale after: ${process.env.SENTINEL_STALE_MINS || 5} min)`);
  console.log(`[cron] reconcile refunds: every ${RECONCILIATION_INTERVAL_MINS} min (min age: ${process.env.RECONCILIATION_MIN_AGE_MINS || 5} min)`);
  console.log(`[cron] reconcile payments: every ${RECONCILIATION_INTERVAL_MINS} min (stale after: ${process.env.PAYMENT_RECONCILIATION_MIN_AGE_MINS || 30} min)`);
  console.log(`[cron] advisory-lock: ${require('./distributedLock').isPostgres() ? 'postgres pg_try_advisory_xact_lock' : 'disabled (sqlite dev)'}`);
}

function stopCron() {
  for (const task of scheduled) {
    try { task.stop(); } catch {}
  }
  scheduled = [];
}

module.exports = {
  initCron,
  stopCron,
  purgeAuditLogs,
  purgeExpiredRefreshTokens,
  purgeExpiredCarts,
  processPickupTimeouts,
  // INO-AUDIT5: reconciliation + outbox workers (re-exported for testing)
  reconcilePendingRefunds,
  reconcileStalePendingPayments,
  processPendingRefundOutbox,
  isCronEnabled,
};
