/**
 * Reconciliation worker — background polling for missed webhooks.
 *
 * The "outbox pattern lite" in transition.service.js + processRefundAfterCommit
 * creates Refund rows with status=PENDING inside the order-transition tx, then
 * makes a best-effort gateway call post-commit. If the gateway call fails (network
 * timeout, 5xx, etc.), the Refund row stays PENDING. The D26 fallback in
 * handleRefundEvent handles the case where the gateway ACCEPTED the refund but
 * the response was lost (gatewayRef = NULL → webhook matches by payment_id +
 * amount). But there are other failure modes:
 *
 *   1. The gateway call never reached Razorpay (network failure before the
 *      request was sent). The Refund is PENDING with gatewayRef=NULL, and no
 *      refund.processed webhook will ever arrive. The refund was never created
 *      at the gateway.
 *
 *   2. The webhook was delivered but our server was down / crashed. The
 *      Payment stays PENDING forever even though Razorpay knows it was captured.
 *
 * This worker periodically polls Razorpay for the status of:
 *   - PENDING Refund rows older than RECONCILIATION_MIN_AGE_MINS (default 5 min)
 *   - PENDING Payment rows older than PAYMENT_RECONCILIATION_MIN_AGE_MINS (default 30 min)
 *
 * If the gateway says a refund was processed, the worker marks it COMPLETED.
 * If the gateway says a payment was captured, the worker marks it PAID.
 * If the gateway says a payment failed, the worker marks it FAILED.
 *
 * All reconciliation actions are audited (REFUND_RECONCILED, PAYMENT_RECONCILED_PAID,
 * PAYMENT_RECONCILED_FAILED) so the audit trail shows the background worker as
 * the actor.
 *
 * Spec ref: §2 principle 4 — "No frontend 'payment success' is trusted." The
 * reconciliation worker is the ultimate backstop for missed webhooks.
 *
 * Env:
 *   - RECONCILIATION_INTERVAL_MINS (default 10) — cron schedule interval
 *   - RECONCILIATION_MIN_AGE_MINS (default 5) — min age before a PENDING refund
 *     is eligible for reconciliation (gives the gateway time to process)
 *   - PAYMENT_RECONCILIATION_MIN_AGE_MINS (default 30) — min age before a PENDING
 *     payment is considered stale (students who haven't completed checkout in
 *     30 min are unlikely to)
 */

const prisma = require('./prisma');
const { audit } = require('./audit');
const { PAYMENT_STATUS, REFUND_STATUS } = require('./constants');
const {
  getOutletRazorpayClient,
  markPaymentRefundedIfFullyRefunded,
  processRefundAfterCommit,
} = require('../modules/payments/payments.service');
const { toPaise } = require('./money');

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Map a Razorpay gateway refund status to our internal REFUND_STATUS.
 * Razorpay uses: 'processed', 'failed', 'created' (pending at gateway).
 * We use: 'COMPLETED', 'FAILED', 'PENDING'.
 */
function mapGatewayRefundStatus(gatewayStatus) {
  const s = String(gatewayStatus || '').toLowerCase();
  if (s === 'processed' || s === 'completed') return REFUND_STATUS.COMPLETED;
  if (s === 'failed') return REFUND_STATUS.FAILED;
  return REFUND_STATUS.PENDING; // 'created', 'pending', etc. — still in flight
}

// ─── Job 1: Reconcile PENDING refunds ──────────────────────────────────────

async function reconcilePendingRefunds() {
  const minAgeMins = parseInt(process.env.RECONCILIATION_MIN_AGE_MINS || '5', 10);
  const cutoff = new Date(Date.now() - minAgeMins * 60 * 1000);

  // Find PENDING refunds older than the cutoff.
  // Only reconcile refunds whose payment has a razorpayPaymentId (we need
  // it to call the gateway). Refunds on payments that never captured can't
  // be reconciled via the gateway.
  const pendingRefunds = await prisma.refund.findMany({
    where: {
      status: REFUND_STATUS.PENDING,
      createdAt: { lt: cutoff },
      payment: { razorpayPaymentId: { not: null } },
    },
    include: {
      payment: { include: { order: { include: { outlet: true } } } },
    },
  });

  let reconciled = 0;
  let stillPending = 0;

  for (const refund of pendingRefunds) {
    if (!refund.payment?.razorpayPaymentId) continue;
    if (!refund.payment?.order?.outletId) continue;

    try {
      const client = await getOutletRazorpayClient(refund.payment.order.outletId);

      let gatewayRefund = null;

      // ─── Case 1: we have the gatewayRef (gateway accepted the refund,
      //     but the webhook was missed OR the status is still pending at
      //     the gateway). Fetch the refund directly. ──────────────────
      if (refund.gatewayRef) {
        try {
          gatewayRefund = await client.refunds.fetch(refund.gatewayRef);
        } catch (fetchErr) {
          // The SDK might not support client.refunds.fetch, OR the refund
          // ID is invalid. Try the older payments.fetchRefund method.
          if (client.payments && typeof client.payments.fetchRefund === 'function') {
            gatewayRefund = await client.payments.fetchRefund(
              refund.payment.razorpayPaymentId,
              refund.gatewayRef
            );
          } else {
            throw fetchErr;
          }
        }
      } else {
        // ─── Case 2: gatewayRef is NULL (the D26 "lost response" case).
        //     The gateway may have accepted the refund but our server
        //     never got the refund ID. List all refunds for the payment
        //     and match by amount. ────────────────────────────────────
        let refundsList = null;
        try {
          // Try the newer refunds API first
          if (client.refunds && typeof client.refunds.fetchAll === 'function') {
            refundsList = await client.refunds.fetchAll({
              payment_id: refund.payment.razorpayPaymentId,
            });
          } else if (client.payments && typeof client.payments.fetchRefunds === 'function') {
            // Older SDK method
            refundsList = await client.payments.fetchRefunds(
              refund.payment.razorpayPaymentId
            );
          }
        } catch (listErr) {
          console.error(
            `[reconciliation:refund] refund ${refund.id}: could not list gateway refunds:`,
            listErr.message
          );
        }

        if (refundsList && Array.isArray(refundsList.items)) {
          const expectedPaise = toPaise(refund.amount);
          // Match by amount (1 paise tolerance for rounding)
          gatewayRefund = refundsList.items.find(r =>
            Math.abs((r.amount || 0) - expectedPaise) <= 1
          );
        }

        if (!gatewayRefund) {
          // No matching refund at the gateway — the refund was never created.
          // This means the gateway call never reached Razorpay (case 1 from
          // the header comment). Leave it PENDING — the admin can retry
          // via POST /api/v1/admin/refunds.
          stillPending++;
          continue;
        }
      }

      const gatewayStatus = String(gatewayRefund.status || '').toLowerCase();
      const newStatus = mapGatewayRefundStatus(gatewayStatus);

      if (newStatus === refund.status) {
        // Still PENDING at the gateway — no change.
        stillPending++;
        continue;
      }

      // Update the Refund row with the new status + fill in gatewayRef
      // if it was NULL.
      const updated = await prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: newStatus,
          gatewayRef: refund.gatewayRef || gatewayRefund.id,
        },
      });

      // If the refund is now COMPLETED, check if the payment is fully
      // refunded (might flip Payment to REFUNDED).
      if (newStatus === REFUND_STATUS.COMPLETED) {
        await markPaymentRefundedIfFullyRefunded(refund.payment.id);
      }

      await audit({
        actorId: null,
        action: 'REFUND_RECONCILED',
        targetType: 'Refund',
        targetId: refund.id,
        before: { status: refund.status, gatewayRef: refund.gatewayRef },
        after: { status: newStatus, gatewayRef: updated.gatewayRef, gatewayStatus },
      });

      reconciled++;
    } catch (err) {
      console.error(
        `[reconciliation:refund] refund ${refund.id} failed:`,
        err.message
      );
    }
  }

  if (reconciled > 0 || stillPending > 0) {
    console.log(
      `[reconciliation:refund] reconciled ${reconciled} PENDING refunds, ` +
      `${stillPending} still pending at gateway (scanned ${pendingRefunds.length})`
    );
  }
  return { reconciled, stillPending, scanned: pendingRefunds.length };
}

// ─── Job 2: Reconcile stale PENDING payments ──────────────────────────────

async function reconcileStalePendingPayments() {
  const minAgeMins = parseInt(process.env.PAYMENT_RECONCILIATION_MIN_AGE_MINS || '30', 10);
  const cutoff = new Date(Date.now() - minAgeMins * 60 * 1000);

  // Find PENDING payments older than the cutoff that have a razorpayOrderId
  // (if no gateway order was created, there's nothing to reconcile — the
  // student never started checkout).
  const stalePayments = await prisma.payment.findMany({
    where: {
      status: PAYMENT_STATUS.PENDING,
      createdAt: { lt: cutoff },
      razorpayOrderId: { not: null },
    },
    include: { order: { include: { outlet: true } } },
  });

  let reconciled = 0;
  let stillPending = 0;

  for (const payment of stalePayments) {
    if (!payment.razorpayOrderId) continue;
    if (!payment.order?.outletId) continue;

    try {
      const client = await getOutletRazorpayClient(payment.order.outletId);

      // Fetch the gateway order — it includes amount_paid + status + attempts.
      const gatewayOrder = await client.orders.fetch(payment.razorpayOrderId);

      const expectedAmountPaise = toPaise(payment.amount);
      const gatewayAmountPaid = gatewayOrder.amount_paid || 0;
      const gatewayOrderStatus = String(gatewayOrder.status || '').toLowerCase();

      // Case 1: the gateway says the payment was captured (we missed the
      // payment.captured webhook). Mark PAID + emit socket event.
      if (gatewayAmountPaid >= expectedAmountPaise) {
        const claimed = await prisma.payment.updateMany({
          where: { id: payment.id, status: PAYMENT_STATUS.PENDING },
          data: {
            status: PAYMENT_STATUS.PAID,
            razorpayPaymentId: gatewayOrder.id, // the gateway order ID doubles as payment ID for orders API
          },
        });
        if (claimed.count !== 1) {
          // Someone else transitioned it concurrently — skip.
          continue;
        }

        await audit({
          actorId: null,
          action: 'PAYMENT_RECONCILED_PAID',
          targetType: 'Payment',
          targetId: payment.id,
          before: { status: PAYMENT_STATUS.PENDING },
          after: { status: PAYMENT_STATUS.PAID, gatewayAmountPaid, gatewayOrderStatus },
        });

        // Emit socket event (the webhook path does this too) so the outlet
        // dashboard picks up the new paid order.
        try {
          const { emitOrderEvent } = require('./socket');
          emitOrderEvent('order:new', `outlet:${payment.order.outletId}`, {
            order: payment.order,
          });
        } catch { /* socket not initialized */ }

        reconciled++;
        continue;
      }

      // Case 2: the gateway order has had many failed attempts — mark the
      // payment FAILED so the student sees it + can retry with a fresh order.
      // Razorpay order status 'attempted' means payment attempts were made
      // but none succeeded. 'failed' means the order itself expired.
      const maxAttempts = parseInt(process.env.PAYMENT_MAX_ATTEMPTS || '5', 10);
      if (gatewayOrderStatus === 'failed' ||
          (gatewayOrder.attempts_count && gatewayOrder.attempts_count >= maxAttempts)) {
        const claimed = await prisma.payment.updateMany({
          where: { id: payment.id, status: PAYMENT_STATUS.PENDING },
          data: { status: PAYMENT_STATUS.FAILED },
        });
        if (claimed.count !== 1) continue;

        await audit({
          actorId: null,
          action: 'PAYMENT_RECONCILED_FAILED',
          targetType: 'Payment',
          targetId: payment.id,
          before: { status: PAYMENT_STATUS.PENDING },
          after: {
            status: PAYMENT_STATUS.FAILED,
            gatewayOrderStatus,
            attempts: gatewayOrder.attempts_count,
          },
        });

        reconciled++;
        continue;
      }

      // Case 3: the gateway order is still 'created' or 'attempted' with
      // few attempts — the student may still complete checkout. Leave it
      // PENDING.
      stillPending++;
    } catch (err) {
      console.error(
        `[reconciliation:payment] payment ${payment.id} failed:`,
        err.message
      );
    }
  }

  if (reconciled > 0 || stillPending > 0) {
    console.log(
      `[reconciliation:payment] reconciled ${reconciled} stale PENDING payments, ` +
      `${stillPending} still legitimately pending (scanned ${stalePayments.length})`
    );
  }
  return { reconciled, stillPending, scanned: stalePayments.length };
}

// ─── Job 3: Outbox worker — process PENDING refunds that were never sent ──
//
// The "outbox pattern" creates a Refund row with status=PENDING inside the
// order-transition transaction. The controller then calls
// processRefundAfterCommit() post-commit to send the refund to the gateway.
// If the server crashes BETWEEN the tx commit and the post-commit call,
// the Refund row stays PENDING with gatewayRef=NULL — the gateway never
// received the refund request.
//
// This worker automatically processes those orphaned PENDING refunds:
//   1. Find Refund rows with status=PENDING AND gatewayRef=NULL AND
//      createdAt < (now - OUTBOX_MIN_AGE_MINS). The grace period gives
//      the controller's post-commit call time to finish.
//   2. Call processRefundAfterCommit(refundId, null) on each — this
//      function is now guarded (if gatewayRef is already set, it returns
//      without creating a duplicate). So if the controller's call raced
//      with the worker, only one gateway refund is created.
//   3. On success, the Refund row gets a gatewayRef + the status from
//      the gateway response. On failure, it stays PENDING + gatewayRef=NULL
//      → the next worker tick retries.
//
// This is distinct from reconcilePendingRefunds (which POLLS the gateway
// for the status of refunds that WERE created) — the outbox worker CREATES
// the refund at the gateway for the first time.
//
// Together, the outbox worker + reconciliation worker form a complete
// financial reliability loop:
//   1. Transition tx creates Refund (PENDING, gatewayRef=NULL)
//   2. Controller post-commit calls processRefundAfterCommit →
//      on success: gatewayRef set, status updated
//      on failure: stays PENDING, gatewayRef=NULL
//   3. Outbox worker (this function) picks up orphans (PENDING, gatewayRef=NULL)
//      and retries the gateway call
//   4. Reconciliation worker polls the gateway for refunds that have a
//      gatewayRef but are still PENDING (webhook was missed, or the
//      gateway hasn't processed yet)

async function processPendingRefundOutbox() {
  const minAgeMins = parseInt(process.env.OUTBOX_MIN_AGE_MINS || '2', 10);
  const cutoff = new Date(Date.now() - minAgeMins * 60 * 1000);

  // Find PENDING refunds with gatewayRef=NULL — these are refunds that
  // were created in the transition tx but never successfully sent to the
  // gateway. Only process refunds whose payment has a razorpayPaymentId
  // (we need it to call the gateway).
  const orphanedRefunds = await prisma.refund.findMany({
    where: {
      status: REFUND_STATUS.PENDING,
      gatewayRef: null,
      createdAt: { lt: cutoff },
      payment: { razorpayPaymentId: { not: null } },
    },
    select: { id: true, paymentId: true },
  });

  let processed = 0;
  let failed = 0;

  for (const { id } of orphanedRefunds) {
    try {
      // processRefundAfterCommit is now guarded: if gatewayRef is already
      // set (e.g. the controller's post-commit call just finished), it
      // returns without creating a duplicate. This makes it safe to call
      // from the worker even if the controller is still in-flight.
      const result = await processRefundAfterCommit(id, null);
      if (result && result.gatewayRef) {
        processed++;
      }
      // If result.gatewayRef is still null, the gateway call failed.
      // The refund stays PENDING + gatewayRef=NULL → next tick retries.
    } catch (err) {
      // processRefundAfterCommit catches gateway errors internally and
      // never throws, but defensive: if something unexpected happens,
      // log + move on.
      console.error(
        `[outbox:refund] refund ${id} failed:`,
        err.message
      );
      failed++;
    }
  }

  if (processed > 0 || failed > 0) {
    console.log(
      `[outbox:refund] processed ${processed} orphaned PENDING refunds, ` +
      `${failed} failed (scanned ${orphanedRefunds.length})`
    );
  }
  return { processed, failed, scanned: orphanedRefunds.length };
}

module.exports = {
  reconcilePendingRefunds,
  reconcileStalePendingPayments,
  processPendingRefundOutbox,
  mapGatewayRefundStatus,
};
