/**
 * Super-admin service — platform-wide overview, user mgmt, outlet mgmt.
 *
 * All endpoints require SUPER_ADMIN role (enforced in routes).
 */

const prisma = require('../../lib/prisma');
const menuRepo = require('../menu/menu.repository');
const ordersRepo = require('../orders/orders.repository');
const { getOutletRazorpayClient } = require('../payments/payments.service');
const { audit } = require('../../lib/audit');
const { ROLES, OUTLET_STATUS, USER_STATUS, PAYMENT_STATUS, REFUND_TRIGGER, REFUND_STATUS } = require('../../lib/constants');

async function getOverview() {
  const [users, outlets, menu, orders] = await Promise.all([
    prisma.user.findMany(),
    prisma.outlet.findMany(),
    menuRepo.findAll(),
    prisma.order.findMany(),
  ]);

  return {
    users: {
      students: users.filter((u) => u.role === ROLES.STUDENT).length,
      outletAdmins: users.filter((u) => u.role === ROLES.OUTLET_ADMIN).length,
      outletStaff: users.filter((u) => u.role === ROLES.OUTLET_STAFF).length,
      superAdmins: users.filter((u) => u.role === ROLES.SUPER_ADMIN).length,
      total: users.length,
    },
    outlets: {
      total: outlets.length,
      open: outlets.filter((o) => o.status === 'OPEN').length,
      busy: outlets.filter((o) => o.status === 'BUSY').length,
      closed: outlets.filter((o) => o.status === 'CLOSED').length,
      pending: outlets.filter((o) => o.status === 'PENDING').length,
      suspended: outlets.filter((o) => o.status === 'SUSPENDED').length,
    },
    menu: {
      total: menu.length,
      available: menu.filter((m) => m.isAvailable).length,
      unavailable: menu.filter((m) => !m.isAvailable).length,
    },
    orders: {
      total: orders.length,
      pending: orders.filter((o) => o.status === 'PENDING').length,
      accepted: orders.filter((o) => o.status === 'ACCEPTED').length,
      preparing: orders.filter((o) => o.status === 'PREPARING').length,
      ready: orders.filter((o) => o.status === 'READY').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
      rejected: orders.filter((o) => o.status === 'REJECTED').length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    },
  };
}

async function getUsers({ page = 1, pageSize = 50 } = {}) {
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { outletStaff: true, studentProfile: true },
    }),
    prisma.user.count(),
  ]);
  // Strip passwordHash
  return {
    items: items.map(({ passwordHash, ...u }) => u),
    total,
    page,
    pageSize,
  };
}

async function getUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { outletStaff: { include: { outlet: true } }, studentProfile: true },
  });
  if (!user) throw { statusCode: 404, message: 'User not found' };
  const { passwordHash, ...safe } = user;
  return safe;
}

async function updateUserStatus(userId, status, reqUserId) {
  if (userId === reqUserId) {
    throw { statusCode: 400, message: 'Super Admins cannot suspend themselves' };
  }
  if (![USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED].includes(status)) {
    throw { statusCode: 400, message: 'Invalid status' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw { statusCode: 404, message: 'User not found' };

  const before = { status: user.status };
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  // On suspend: revoke all refresh tokens
  if (status === USER_STATUS.SUSPENDED) {
    const { revokeAllForUser } = require('../../lib/tokens');
    await revokeAllForUser(userId);
  }

  const { passwordHash, ...safe } = updated;
  return { user: safe, before };
}

async function getOutlets() {
  return prisma.outlet.findMany({ include: { staff: true } });
}

async function getOutlet(outletId) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw { statusCode: 404, message: 'Outlet not found' };
  return outlet;
}

async function updateOutletStatus(outletId, status) {
  if (!Object.values(OUTLET_STATUS).includes(status)) {
    throw { statusCode: 400, message: `Invalid status. Must be one of: ${Object.values(OUTLET_STATUS).join(', ')}` };
  }
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw { statusCode: 404, message: 'Outlet not found' };

  const before = { status: outlet.status };
  const updated = await prisma.outlet.update({
    where: { id: outletId },
    data: { status },
  });
  return { outlet: updated, before };
}

async function getOrders({ page = 1, pageSize = 100 } = {}) {
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true, payment: true, student: { select: { id: true, email: true, name: true } }, outlet: true },
    }),
    prisma.order.count(),
  ]);
  return { items, total, page, pageSize };
}

async function getOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: { include: { refunds: true } }, student: true, outlet: true },
  });
  if (!order) throw { statusCode: 404, message: 'Order not found' };
  return order;
}

async function getMenu() {
  return menuRepo.findAll();
}

async function getMenuItem(itemId) {
  const item = await menuRepo.findById(itemId);
  if (!item) throw { statusCode: 404, message: 'Menu item not found' };
  return item;
}

async function updateMenuItemStatus(itemId, isAvailable) {
  if (typeof isAvailable !== 'boolean') {
    throw { statusCode: 400, message: 'isAvailable must be a boolean' };
  }
  const item = await menuRepo.findById(itemId);
  if (!item) throw { statusCode: 404, message: 'Menu item not found' };
  const before = { isAvailable: item.isAvailable };
  const updated = await menuRepo.update(itemId, { isAvailable });
  return { item: updated, before };
}

// ─── INO-P0-7 / INO-P0-8 / INO-P0-9 ─────────────────────────────────────────
// Super-admin manual refund endpoint. Serves two purposes:
//   1. Issue a fresh manual refund for an order whose payment is PAID but
//      no refund has been initiated (e.g. super-admin decided to refund
//      outside the normal cancel/reject flow).
//   2. RETRY an existing PENDING refund — the previous auto-refund flow
//      could leave the system in:
//        Order = CANCELLED, Payment = PAID, Refund = PENDING
//      if the Razorpay refund API call failed. Without this endpoint,
//      there was no application-level way to resolve the inconsistency —
//      the only "recovery" was for someone to log into the Razorpay
//      dashboard and manually re-trigger, with no DB record of the retry.
//
// The endpoint is idempotent in the sense that:
//   - If a PENDING refund exists for this payment, we retry THAT one
//     (don't create a duplicate Refund row).
//   - If no PENDING refund exists, we issue a fresh one with
//     triggeredBy = SUPER_ADMIN_MANUAL.
//   - If a COMPLETED refund already exists, we reject (can't refund twice).
async function issueManualRefund(orderId, { amount, reason }, actorId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: { include: { refunds: true } },
      outlet: true,
    },
  });
  if (!order) throw { statusCode: 404, message: 'Order not found' };
  if (!order.payment) throw { statusCode: 400, message: 'Order has no payment to refund' };
  if (order.payment.status !== PAYMENT_STATUS.PAID && order.payment.status !== PAYMENT_STATUS.REFUNDED) {
    throw {
      statusCode: 400,
      message: `Cannot refund a payment in state ${order.payment.status}. Only PAID or REFUNDED payments are eligible.`,
    };
  }

  // Refuse if a COMPLETED refund already exists — can't refund twice.
  const completedRefund = order.payment.refunds.find(r => r.status === REFUND_STATUS.COMPLETED);
  if (completedRefund) {
    throw {
      statusCode: 409,
      code: 'REFUND_ALREADY_COMPLETED',
      message: `Refund ${completedRefund.id} is already COMPLETED for this payment. Cannot refund again.`,
    };
  }

  // Retry path: a PENDING refund exists (likely from a failed auto-refund).
  const existingPending = order.payment.refunds.find(r => r.status === REFUND_STATUS.PENDING);
  if (existingPending) {
    let gatewayRef = existingPending.gatewayRef;
    let refundStatus = REFUND_STATUS.PENDING;
    try {
      const client = await getOutletRazorpayClient(order.outletId);
      const gatewayRefund = await client.payments.refund(order.payment.razorpayPaymentId, {
        amount: Math.round(Number(existingPending.amount) * 100),
        notes: {
          orderId: order.id,
          trigger: existingPending.triggeredBy,
          reason: `Retry: ${reason || existingPending.reason}`,
        },
      });
      gatewayRef = gatewayRefund.id;
      refundStatus = (gatewayRefund.status || 'PENDING').toUpperCase();
    } catch (err) {
      console.error('[admin:refund-retry] gateway call failed:', err.message);
      // Leave as PENDING so it can be retried again later.
    }

    const updated = await prisma.refund.update({
      where: { id: existingPending.id },
      data: { gatewayRef, status: refundStatus },
    });

    if (refundStatus === REFUND_STATUS.COMPLETED || refundStatus === 'PROCESSED') {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { status: PAYMENT_STATUS.REFUNDED },
      });
    }

    await audit({
      actorId,
      action: 'REFUND_RETRIED',
      targetType: 'Refund',
      targetId: updated.id,
      after: { amount: updated.amount, status: refundStatus, gatewayRef },
    });
    return { refund: updated, retried: true };
  }

  // Fresh manual refund path.
  let gatewayRef = null;
  let refundStatus = REFUND_STATUS.PENDING;
  try {
    const client = await getOutletRazorpayClient(order.outletId);
    const gatewayRefund = await client.payments.refund(order.payment.razorpayPaymentId, {
      amount: Math.round(Number(amount) * 100),
      notes: {
        orderId: order.id,
        trigger: REFUND_TRIGGER.SUPER_ADMIN_MANUAL,
        reason,
      },
    });
    gatewayRef = gatewayRefund.id;
    refundStatus = (gatewayRefund.status || 'PENDING').toUpperCase();
  } catch (err) {
    console.error('[admin:refund] gateway call failed:', err.message);
    // Mark refund as PENDING so it can be retried via this same endpoint.
  }

  const refund = await prisma.refund.create({
    data: {
      paymentId: order.payment.id,
      amount,
      reason,
      gatewayRef,
      status: refundStatus,
      triggeredBy: REFUND_TRIGGER.SUPER_ADMIN_MANUAL,
      initiatedBy: actorId,
    },
  });

  if (refundStatus === REFUND_STATUS.COMPLETED || refundStatus === 'PROCESSED') {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { status: PAYMENT_STATUS.REFUNDED },
    });
  }

  await audit({
    actorId,
    action: 'REFUND_ISSUED_MANUAL',
    targetType: 'Refund',
    targetId: refund.id,
    after: { amount, reason, gatewayRef, trigger: REFUND_TRIGGER.SUPER_ADMIN_MANUAL },
  });

  return { refund, retried: false };
}

module.exports = {
  getOverview,
  getUsers,
  getUser,
  updateUserStatus,
  getOutlets,
  getOutlet,
  updateOutletStatus,
  getOrders,
  getOrder,
  getMenu,
  getMenuItem,
  updateMenuItemStatus,
  issueManualRefund,
};
