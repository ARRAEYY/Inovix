/**
 * Order transition service — the single transactional owner of order
 * status changes.
 *
 * Architectural refactor (the bigger refactor flagged in commit ab26f92):
 * the audit observed that business invariants for an order transition were
 * spread across constants.js, orders.service.js, orders.repository.js,
 * orders.controller.js, payments.service.js, notifications.service.js,
 * socket.js, and the frontend — making it easy to end up with:
 *   DB says CANCELLED, Payment says PAID, Refund says PENDING,
 *   Notification missing, Socket not delivered, Frontend says PREPARING
 *
 * This service pulls the DB-touching parts into ONE place, wrapped in a
 * single prisma.$transaction so the order status + audit log entry +
 * notification + refund intent all commit atomically. If the tx commits,
 * the DB state is consistent. If it rolls back (crash, validation error,
 * concurrent transition), nothing was written.
 *
 * The post-commit side effects — gateway refund call, socket emission —
 * are deliberately OUTSIDE the tx (network calls don't belong in a DB
 * transaction). The controller owns those:
 *   1. tx commits → DB state consistent (order + audit + notification + refund intent)
 *   2. post-commit gateway refund call (best-effort — if it fails, the
 *      Refund row stays PENDING and can be retried via /api/v1/admin/refunds)
 *   3. post-commit socket emit (best-effort — clients reconnect and
 *      re-fetch on next render anyway)
 *
 * This is the "outbox pattern" lite: the Refund row is the outbox message,
 * the gateway call is the message processor. Failed processing is visible
 * (Refund.status = PENDING) and recoverable.
 *
 * Spec ref: §8.6 order state machine + §3 enforcement Layer 1
 * (events emitted only AFTER DB transaction commits, never before).
 */

const prisma = require('../../lib/prisma');
const {
  ORDER_STATUS,
  ALLOWED_TRANSITIONS,
  REFUND_TRIGGERS,
  REFUND_STATUS,
  PAYMENT_STATUS,
  NOTIFICATION_TYPE,
  ERROR_CODES,
} = require('../../lib/constants');
const { NOTIFICATION_TEMPLATES } = require('../notifications/notifications.service');

// Map order status → notification type for student-visible transitions.
// PREPARING is included (INO-P0-10 fix). null means no notification.
const STATUS_TO_NOTIFICATION = {
  [ORDER_STATUS.ACCEPTED]:  NOTIFICATION_TYPE.ORDER_ACCEPTED,
  [ORDER_STATUS.PREPARING]: NOTIFICATION_TYPE.ORDER_PREPARING,
  [ORDER_STATUS.READY]:     NOTIFICATION_TYPE.ORDER_READY,
  [ORDER_STATUS.COMPLETED]: NOTIFICATION_TYPE.ORDER_COMPLETED,
  [ORDER_STATUS.REJECTED]:  NOTIFICATION_TYPE.ORDER_REJECTED,
  [ORDER_STATUS.CANCELLED]: NOTIFICATION_TYPE.ORDER_CANCELLED,
};

/**
 * Perform an order status transition atomically.
 *
 * Inside a single prisma.$transaction:
 *   1. Read the order (inside the tx so we see the latest committed state)
 *   2. Verify status === expectedFromStatus (else 409 CONFLICT)
 *   3. Build the new timeline entry
 *   4. updateMany WHERE id AND status = expectedFromStatus → atomic claim
 *      (only one concurrent caller gets count === 1)
 *   5. Create the AuditLog entry
 *   6. Create the Notification row (for student-visible transitions)
 *   7. Create the Refund intent row (for refundable transitions — status=PENDING)
 *
 * The gateway refund call + socket emission happen AFTER the tx commits,
 * in the controller. If the gateway call fails, the Refund row stays
 * PENDING and can be retried via /api/v1/admin/refunds.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.expectedFromStatus - the status the caller thinks the order is in
 * @param {string} params.toStatus - target status
 * @param {string} params.actorId - user id of the actor (for audit + refund.initiatedBy)
 * @param {string} [params.reason] - optional reason (for cancellation/rejection)
 * @param {string} [params.triggerOverride] - override the refund trigger (e.g. 'CUSTOMER_CANCEL')
 * @param {Object} [params.req] - Express request (for IP + User-Agent in audit)
 * @returns {Promise<{ updated: Object, before: Object, refundIntent: Object|null, notification: Object|null }>}
 */
async function performTransition({
  orderId,
  expectedFromStatus,
  toStatus,
  actorId,
  reason,
  triggerOverride = null,
  req = null,
}) {
  // ─── Validate the transition (outside the tx — cheap, stateless) ──────
  if (!Object.values(ORDER_STATUS).includes(toStatus)) {
    throw { statusCode: 400, message: 'Invalid status' };
  }
  const allowedNext = ALLOWED_TRANSITIONS[expectedFromStatus] || [];
  if (!allowedNext.includes(toStatus)) {
    throw {
      statusCode: 400,
      code: ERROR_CODES.INVALID_TRANSITION,
      message: `Cannot transition from ${expectedFromStatus} to ${toStatus}`,
    };
  }

  // Determine refund trigger (null = no refund for this transition)
  const triggerKey = `${expectedFromStatus}_TO_${toStatus}`;
  const trigger = triggerOverride || REFUND_TRIGGERS[triggerKey] || null;

  // Determine notification type (null = no notification)
  const notificationType = STATUS_TO_NOTIFICATION[toStatus] || null;

  // ─── Atomic DB write ──────────────────────────────────────────────────
  return prisma.$transaction(async (tx) => {
    // Read inside the tx so we see the latest committed state.
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payment: { include: { refunds: true } },
        outlet: { select: { id: true, name: true } },
      },
    });
    if (!order) {
      throw { statusCode: 404, message: 'Order not found' };
    }
    // The caller's view of the status is stale — another request got here first.
    if (order.status !== expectedFromStatus) {
      throw {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: 'Order was modified by another request; please retry',
      };
    }

    // Build timeline entry.
    const now = new Date();
    const timeline = JSON.parse(order.timeline || '[]');
    timeline.push({
      status: toStatus,
      at: now.toISOString(),
      by: actorId,
      ...(reason ? { reason } : {}),
    });

    // Build update data — status + timestamps.
    const data = {
      status: toStatus,
      timeline: JSON.stringify(timeline),
    };
    if (toStatus === ORDER_STATUS.ACCEPTED) data.acceptedAt = now;
    if (toStatus === ORDER_STATUS.READY) data.readyAt = now;
    if (toStatus === ORDER_STATUS.COMPLETED) data.completedAt = now;
    if (toStatus === ORDER_STATUS.REJECTED || toStatus === ORDER_STATUS.CANCELLED) {
      data.cancelledAt = now;
      if (reason) data.cancelReason = reason;
    }

    // Atomic claim — only succeeds if status is still expectedFromStatus.
    // Two concurrent callers for the same transition will only let ONE
    // through (the other's updateMany count = 0 → throws 409 below).
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: expectedFromStatus },
      data,
    });
    if (claimed.count !== 1) {
      throw {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: 'Order was modified by another request; please retry',
      };
    }

    // Re-read the updated order (with items + payment for the response).
    const updated = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: { include: { refunds: true } },
      },
    });

    // ─── Audit log (in tx — rolls back if anything later fails) ──────
    await tx.auditLog.create({
      data: {
        actorUserId: actorId || null,
        action: 'ORDER_STATUS_CHANGED',
        targetType: 'Order',
        targetId: orderId,
        before: JSON.stringify({ status: expectedFromStatus }),
        after: JSON.stringify({ status: toStatus }),
        ip: req?.ip || req?.socket?.remoteAddress || null,
        userAgent: req?.get?.('user-agent') || null,
      },
    });

    // ─── Notification (in tx — for student-visible transitions) ─────
    let notification = null;
    if (notificationType) {
      const template = NOTIFICATION_TEMPLATES[notificationType];
      if (template) {
        notification = await tx.notification.create({
          data: {
            userId: order.studentId,
            type: notificationType,
            title: template.title,
            message: template.message(updated),
            payload: JSON.stringify({
              orderId: order.id,
              orderNumber: order.orderNumber,
              pickupCode: order.pickupCode,
            }),
            orderId: order.id,
          },
        });
      }
    }

    // ─── Refund intent (in tx — for refundable transitions) ──────────
    // The Refund row is created with status=PENDING. The actual gateway
    // call happens AFTER the tx commits (in the controller) — network
    // calls don't belong in a DB transaction. If the gateway call fails,
    // the Refund row stays PENDING and can be retried via
    // /api/v1/admin/refunds. This is the "outbox pattern" lite.
    let refundIntent = null;
    if (trigger && order.payment && order.payment.status === PAYMENT_STATUS.PAID) {
      // Idempotency: if a Refund row already exists for this
      // (paymentId, triggeredBy) pair, return it without creating a
      // duplicate. This makes retry / double-trigger paths safe.
      const existing = order.payment.refunds.find(r => r.triggeredBy === trigger);
      if (existing) {
        refundIntent = existing;
      } else {
        refundIntent = await tx.refund.create({
          data: {
            paymentId: order.payment.id,
            amount: order.totalAmount,
            reason: `Auto refund: ${expectedFromStatus} → ${toStatus}`,
            gatewayRef: null, // filled in post-commit if gateway call succeeds
            status: REFUND_STATUS.PENDING,
            triggeredBy: trigger,
            initiatedBy: actorId,
          },
        });
      }
    }

    return {
      updated,
      before: { status: expectedFromStatus },
      refundIntent,
      notification,
    };
  });
}

module.exports = {
  performTransition,
  STATUS_TO_NOTIFICATION,
};
