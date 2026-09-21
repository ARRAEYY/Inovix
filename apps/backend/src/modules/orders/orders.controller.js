const ordersService = require('./orders.service');
const { audit } = require('../../lib/audit');
const { emitOrderEvent } = require('../../lib/socket');
const { ORDER_STATUS } = require('../../lib/constants');
const { processAutoRefundOnTransition } = require('../payments/payments.service');
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
    const { updated, before } = await ordersService.cancelOrder(req.user.id, req.params.orderId);

    // INO-P0-3: process refund BEFORE responding so the HTTP response reflects
    // the actual refund outcome. (Refund idempotency is enforced in
    // processAutoRefundOnTransition — it now checks for an existing Refund
    // row with the same paymentId + trigger before issuing another.)
    await processAutoRefundOnTransition(req.params.orderId, before.status, ORDER_STATUS.CANCELLED, req.user.id, 'CUSTOMER_CANCEL');

    await audit({
      actorId: req.user.id,
      action: 'ORDER_CANCELLED_BY_CUSTOMER',
      targetType: 'Order',
      targetId: req.params.orderId,
      before,
      after: { status: updated.status },
      req,
    });

    // INO-P0-2 fix: socket room names must include the `outlet:` prefix —
    // the socket server joins outlet staff to `outlet:<id>` rooms (see
    // lib/socket.js). Emitting to bare `<outletId>` reaches no-one.
    emitOrderEvent('order:status:changed', `student:${updated.studentId}`, { order: updated });
    emitOrderEvent('order:status:changed', `outlet:${updated.outletId}`, { order: updated });

    // INO-P0-11 fix: await notification creation so a failure here surfaces
    // as a 500 instead of being silently lost. Previously the promise was
    // floating — the HTTP response could succeed while notification
    // creation failed silently.
    await notificationsService.createForOrder(updated, req.user.id);

    res.status(200).json({ success: true, data: updated });
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

    const { updated, before } = await ordersService.updateOrderStatus(
      outletId, orderId, status, req.user.id, reason
    );

    await audit({
      actorId: req.user.id,
      action: 'ORDER_STATUS_CHANGED',
      targetType: 'Order',
      targetId: orderId,
      before,
      after: { status: updated.status },
      req,
    });

    // INO-P0-3: process refund BEFORE responding so the HTTP response reflects
    // the actual refund outcome.
    if (status === ORDER_STATUS.REJECTED || status === ORDER_STATUS.CANCELLED) {
      await processAutoRefundOnTransition(orderId, before.status, status, req.user.id);
    }

    // INO-P0-2 fix: socket room names must include the `outlet:` prefix.
    // Real-time updates to both outlet and student.
    emitOrderEvent('order:status:changed', `outlet:${outletId}`, { order: updated });
    emitOrderEvent('order:status:changed', `student:${updated.studentId}`, { order: updated });

    // INO-P0-10 fix: PREPARING was missing from the notification trigger
    // list — students never got a "your order is being prepared" push.
    // notifications.service.createForOrder already has the template; the
    // controller just wasn't calling it for PREPARING transitions.
    // INO-P0-11 fix: also await the call so failures surface.
    if (
      status === ORDER_STATUS.ACCEPTED ||
      status === ORDER_STATUS.PREPARING ||
      status === ORDER_STATUS.READY ||
      status === ORDER_STATUS.COMPLETED ||
      status === ORDER_STATUS.REJECTED ||
      status === ORDER_STATUS.CANCELLED
    ) {
      await notificationsService.createForOrder(updated, req.user.id);
    }

    res.status(200).json({ success: true, data: updated });
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
  getOutletOrder,
  updateOrderStatus,
};
