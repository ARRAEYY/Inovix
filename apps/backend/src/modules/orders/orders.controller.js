const ordersService = require('./orders.service');
const { performTransition } = require('./transition.service');
const { audit } = require('../../lib/audit');
const { emitOrderEvent, emitNotificationEvent } = require('../../lib/socket');
const { ORDER_STATUS, ERROR_CODES } = require('../../lib/constants');
const { processRefundAfterCommit } = require('../payments/payments.service');
const notificationsService = require('../notifications/notifications.service');

async function createOrder(req, res, next) {
  try {
    const studentId = req.user.id;
    const order = await ordersService.createOrder(studentId, req.body);

    await audit({
      actorId: studentId,
      action: 'ORDER_CREATED',
      targetType: 'Order',
      targetId: order.id,
      after: { id: order.id, orderNumber: order.orderNumber, totalAmount: order.totalAmount },
      req,
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

async function cancelOrder(req, res, next) {
  try {
    // Pre-flight authorization — read the order to verify studentId matches.
    // (Kept outside the tx so we don't hold a lock during the auth check.)
    const existing = await ordersService.getOrderById(req.user.id, req.params.orderId);
    if (existing.status !== ORDER_STATUS.PENDING) {
      throw {
        statusCode: 400,
        code: ERROR_CODES.INVALID_TRANSITION,
        message: 'Orders can only be cancelled before the outlet accepts them',
      };
    }

    // Architectural refactor: the order transition + audit + notification +
    // refund intent are now atomic (single prisma.$transaction in
    // performTransition). The gateway refund call + socket emit are
    // post-commit best-effort.
    const result = await performTransition({
      orderId: req.params.orderId,
      expectedFromStatus: existing.status,
      toStatus: ORDER_STATUS.CANCELLED,
      actorId: req.user.id,
      reason: 'Cancelled by customer',
      triggerOverride: 'CUSTOMER_CANCEL',
      req,
    });

    // Audit the customer-initiated cancel action (separate from the
    // ORDER_STATUS_CHANGED row that performTransition already wrote).
    await audit({
      actorId: req.user.id,
      action: 'ORDER_CANCELLED_BY_CUSTOMER',
      targetType: 'Order',
      targetId: req.params.orderId,
      before: result.before,
      after: { status: result.updated.status },
      req,
    });

    // Post-commit: best-effort gateway refund. The Refund row was created
    // inside the tx with status=PENDING. If the gateway call fails, the
    // Refund row stays PENDING — recoverable via /api/v1/admin/refunds.
    if (result.refundIntent && result.refundIntent.status !== 'COMPLETED') {
      try {
        await processRefundAfterCommit(result.refundIntent.id, req.user.id);
      } catch (err) {
        console.error('[orders.cancel] post-commit refund failed:', err.message);
      }
    }

    // Post-commit: socket events (DB state is already consistent).
    emitOrderEvent('order:status:changed', `student:${result.updated.studentId}`, { order: result.updated });
    emitOrderEvent('order:status:changed', `outlet:${result.updated.outletId}`, { order: result.updated });
    if (result.notification) {
      emitNotificationEvent(result.updated.studentId, result.notification);
    }

    res.status(200).json({ success: true, data: result.updated });
  } catch (error) {
    next(error);
  }
}
async function getUserOrders(req, res, next) {
  try {
    const studentId = req.user.id;
    const { page, pageSize, status } = req.query;
    const orders = await ordersService.getUserOrders(studentId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
    });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    const studentId = req.user.id;
    const { orderId } = req.params;
    const order = await ordersService.getOrderById(studentId, orderId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

async function getOutletOrders(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };

    const { page, pageSize, status } = req.query;
    const orders = await ordersService.getOutletOrders(outletId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
      status,
    });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

// INO-P1-32: dedicated KPI endpoint for the outlet dashboard. Returns
// per-status counts via a single DB groupBy query — the frontend no
// longer needs to pull up to 200 order rows and filter in JS.
async function getOutletKPIs(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };
    const counts = await ordersService.getOutletKPIs(outletId);
    res.status(200).json({ success: true, data: counts });
  } catch (error) {
    next(error);
  }
}

async function getOutletOrder(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };
    const { orderId } = req.params;
    const order = await ordersService.getOutletOrder(outletId, orderId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };

    const { orderId } = req.params;
    const { status, reason } = req.body;

    // Pre-flight: read the order for authorization (outlet scope check)
    // + payment-status guard. Kept outside the tx so we don't hold a lock
    // during the auth check.
    const existing = await ordersService.getOutletOrder(outletId, orderId);
    // ^ throws 404 if not found, 403 if outletId mismatch — same behavior
    //   as the previous ordersService.updateOrderStatus implementation.

    if (!Object.values(ORDER_STATUS).includes(status)) {
      throw { statusCode: 400, message: 'Invalid status' };
    }

    // Payment guard: don't allow state changes on unpaid orders (except
    // for CANCELLED/REJECTED which can refund an unpaid-but-confirmed
    // order — edge case but the spec allows it for outlet rejection).
    if (existing.payment?.status !== 'PAID' && status !== 'CANCELLED' && status !== 'REJECTED') {
      throw {
        statusCode: 400,
        code: ERROR_CODES.PAYMENT_REQUIRED,
        message: 'Order payment has not been confirmed',
      };
    }

    // Architectural refactor: the order transition + audit + notification +
    // refund intent are now atomic (single prisma.$transaction in
    // performTransition). The gateway refund call + socket emit are
    // post-commit best-effort.
    const result = await performTransition({
      orderId,
      expectedFromStatus: existing.status,
      toStatus: status,
      actorId: req.user.id,
      reason,
      req,
    });

    // Post-commit: best-effort gateway refund. The Refund row was created
    // inside the tx with status=PENDING. If the gateway call fails, the
    // Refund row stays PENDING — recoverable via /api/v1/admin/refunds.
    if (result.refundIntent && result.refundIntent.status !== 'COMPLETED') {
      try {
        await processRefundAfterCommit(result.refundIntent.id, req.user.id);
      } catch (err) {
        console.error('[orders.updateStatus] post-commit refund failed:', err.message);
      }
    }

    // Post-commit: socket events. INO-P0-2 fix — room names with `outlet:`
    // prefix; PREPARING notification now triggered (INO-P0-10).
    emitOrderEvent('order:status:changed', `outlet:${outletId}`, { order: result.updated });
    emitOrderEvent('order:status:changed', `student:${result.updated.studentId}`, { order: result.updated });
    if (result.notification) {
      emitNotificationEvent(result.updated.studentId, result.notification);
    }

    res.status(200).json({ success: true, data: result.updated });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getUserOrders,
  cancelOrder,
  getOrderById,
  getOutletOrders,
  getOutletKPIs,
  getOutletOrder,
  updateOrderStatus,
  verifyPickupCode,
};

/**
 * Verify Pickup Code — outlet staff enters the 4-digit code the student
 * gives them at the counter. If it matches order.pickupCode, the order
 * is transitioned READY → COMPLETED.
 *
 * Only works on READY orders (the student should have the food in hand).
 * Returns 400 if the code doesn't match or the order isn't READY.
 */
async function verifyPickupCode(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };

    const { orderId } = req.params;
    const { pickupCode } = req.body;

    if (!pickupCode || !/^\d{4}$/.test(pickupCode)) {
      return res.status(400).json({
        success: false,
        message: 'Pickup code must be a 4-digit number',
        code: 'INVALID_PICKUP_CODE',
      });
    }

    // Verify outlet scope
    const existing = await ordersService.getOutletOrder(outletId, orderId);

    if (existing.status !== ORDER_STATUS.READY) {
      return res.status(400).json({
        success: false,
        message: `Order must be READY to verify pickup. Current status: ${existing.status}`,
        code: 'INVALID_TRANSITION',
      });
    }

    // Check the pickup code
    if (existing.pickupCode !== pickupCode) {
      await audit({
        actorId: req.user.id,
        action: 'PICKUP_CODE_MISMATCH',
        targetType: 'Order',
        targetId: orderId,
        after: { providedCode: pickupCode },
        req,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid pickup code. Please ask the student for the correct code.',
        code: 'PICKUP_CODE_MISMATCH',
      });
    }

    // Code matches — transition READY → COMPLETED
    const result = await performTransition({
      orderId,
      expectedFromStatus: ORDER_STATUS.READY,
      toStatus: ORDER_STATUS.COMPLETED,
      actorId: req.user.id,
      req,
    });

    await audit({
      actorId: req.user.id,
      action: 'PICKUP_VERIFIED',
      targetType: 'Order',
      targetId: orderId,
      after: { status: ORDER_STATUS.COMPLETED, pickupCode },
      req,
    });

    res.status(200).json({ success: true, data: result.updated });
  } catch (error) {
    next(error);
  }
}
