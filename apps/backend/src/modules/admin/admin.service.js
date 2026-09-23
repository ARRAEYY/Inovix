/**
 * Super-admin service — platform-wide overview, user mgmt, outlet mgmt.
 *
 * All endpoints require SUPER_ADMIN role (enforced in routes).
 */

const prisma = require('../../lib/prisma');
const menuRepo = require('../menu/menu.repository');
const ordersRepo = require('../orders/orders.repository');
const { getOutletRazorpayClient, markPaymentRefundedIfFullyRefunded } = require('../payments/payments.service');
const { audit } = require('../../lib/audit');
const { toPaise, remainingRefundable } = require('../../lib/money');
const { isPostgres } = require('../../lib/distributedLock');
const {
  ROLES,
  OUTLET_STATUS,
  USER_STATUS,
  PAYMENT_STATUS,
  REFUND_TRIGGER,
  REFUND_STATUS,
  ORDER_STATUS,
} = require('../../lib/constants');

// INO-P1-31 fix: previously getOverview loaded EVERY user, outlet, order,
// and menu item into memory and counted in JS via `.filter().length`. For
// a deployment with 100k orders / 100k users, every dashboard refresh
// pulled the entire tables across the wire and looped through them — slow
// and memory-heavy. Now we push the counts to the DB via groupBy/count
// aggregation queries. The response shape is unchanged so the admin
// frontend doesn't need updating.
async function getOverview() {
  const [
    userRoleGroups,
    outletStatusGroups,
    orderStatusGroups,
    menuAvailableCount,
    menuUnavailableCount,
    userTotal,
    outletTotal,
    orderTotal,
    menuTotal,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: true }),
    prisma.outlet.groupBy({ by: ['status'], _count: true }),
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.menuItem.count({ where: { isAvailable: true } }),
    prisma.menuItem.count({ where: { isAvailable: false } }),
    prisma.user.count(),
    prisma.outlet.count(),
    prisma.order.count(),
    prisma.menuItem.count(),
  ]);

  // Reassemble the groupBy results into the same response shape as before.
  const usersByRole = {};
  for (const g of userRoleGroups) usersByRole[g.role] = g._count;
  const outletsByStatus = {};
  for (const g of outletStatusGroups) outletsByStatus[g.status] = g._count;
  const ordersByStatus = {};
  for (const g of orderStatusGroups) ordersByStatus[g.status] = g._count;

  return {
    users: {
      students: usersByRole[ROLES.STUDENT] || 0,
      outletAdmins: usersByRole[ROLES.OUTLET_ADMIN] || 0,
      outletStaff: usersByRole[ROLES.OUTLET_STAFF] || 0,
      superAdmins: usersByRole[ROLES.SUPER_ADMIN] || 0,
      total: userTotal,
    },
    outlets: {
      total: outletTotal,
      open: outletsByStatus[OUTLET_STATUS.OPEN] || 0,
      busy: outletsByStatus[OUTLET_STATUS.BUSY] || 0,
      closed: outletsByStatus[OUTLET_STATUS.CLOSED] || 0,
      pending: outletsByStatus[OUTLET_STATUS.PENDING] || 0,
      suspended: outletsByStatus[OUTLET_STATUS.SUSPENDED] || 0,
    },
    menu: {
      total: menuTotal,
      available: menuAvailableCount,
      unavailable: menuUnavailableCount,
    },
    orders: {
      total: orderTotal,
      pending: ordersByStatus[ORDER_STATUS.PENDING] || 0,
      accepted: ordersByStatus[ORDER_STATUS.ACCEPTED] || 0,
      preparing: ordersByStatus[ORDER_STATUS.PREPARING] || 0,
      ready: ordersByStatus[ORDER_STATUS.READY] || 0,
      completed: ordersByStatus[ORDER_STATUS.COMPLETED] || 0,
      rejected: ordersByStatus[ORDER_STATUS.REJECTED] || 0,
      cancelled: ordersByStatus[ORDER_STATUS.CANCELLED] || 0,
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

async function createOutlet(data) {
  const { name, description, location, contactNumber, contactEmail, openingTime, closingTime, status = 'OPEN' } = data;
  if (!name) throw { statusCode: 400, message: 'Outlet name is required' };
  return prisma.outlet.create({
    data: {
      name,
      description: description || null,
      location: location || null,
      contactNumber: contactNumber || null,
      contactEmail: contactEmail || null,
      openingTime: openingTime || '09:00',
      closingTime: closingTime || '22:00',
      status: status || 'OPEN',
    },
  });
}

async function getAllStaff() {
  const staff = await prisma.outletStaff.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      },
      outlet: {
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
        },
      },
    },
  });
  return staff;
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

  // ─── INO-AUDIT4-D23 fix: allow multiple SUPER_ADMIN_MANUAL refunds ────
  // The previous implementation rejected if ANY COMPLETED refund existed
  // on the payment. That made partial refunds impossible to complete:
  //   ₹1000 payment → ₹300 manual refund COMPLETED → can't refund the
  //   remaining ₹700 because a COMPLETED refund already exists.
  // The remaining-refundable check below (payment.amount − sum(COMPLETED
  // + PENDING)) is the correct guard — it prevents over-refunding without
  // blocking legitimate partial refunds. So the "reject if COMPLETED"
  // check is removed; the remaining-refundable check is sufficient.
  //
  // The retry path (PENDING refund exists) still works the same way —
  // a PENDING refund represents an in-flight refund attempt that may
  // not have reached the gateway yet. Retrying it is correct.

  // Retry path: a PENDING refund exists (likely from a failed auto-refund
  // OR a previous manual refund attempt whose gateway response was lost).
  // The existing PENDING refund's amount was already validated when it
  // was created, so we don't re-check here — we just retry the gateway call.

  // ─── INO-AUDIT3-1 fix: enforce refund amount bounds server-side ──────
  // The previous implementation passed `amount` straight to Razorpay without
  // checking it against the payment's remaining refundable amount. A super-
  // admin could submit { amount: 999999 } and the app would rely on Razorpay
  // to reject it. The business invariant belongs to the application.
  //
  //   remaining = payment.amount - sum(COMPLETED refunds) - sum(PENDING refunds)
  //
  // PENDING refunds are subtracted too because they represent in-flight
  // refund attempts that may still complete. If a PENDING refund exists,
  // the retry path below handles it — the fresh-refund path is only
  // reached when no PENDING refund exists, so remaining is just
  // payment.amount - sum(COMPLETED refunds) in practice.
  const paymentAmount = Number(order.payment.amount);
  const alreadyRefunded = order.payment.refunds
    .filter(r => r.status === REFUND_STATUS.COMPLETED || r.status === REFUND_STATUS.PENDING)
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const remainingRefundable = paymentAmount - alreadyRefunded;

  const requestedAmount = Number(amount);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw {
      statusCode: 400,
      code: 'INVALID_REFUND_AMOUNT',
      message: 'Refund amount must be a positive number.',
    };
  }
  if (requestedAmount > remainingRefundable) {
    throw {
      statusCode: 400,
      code: 'REFUND_AMOUNT_EXCEEDS_REMAINING',
      message: `Refund amount ₹${requestedAmount.toFixed(2)} exceeds remaining refundable amount ₹${remainingRefundable.toFixed(2)} (payment ₹${paymentAmount.toFixed(2)} − already refunded ₹${alreadyRefunded.toFixed(2)}).`,
    };
  }

  // Retry path: a PENDING refund exists (likely from a failed auto-refund).
  // The existing PENDING refund's amount was already validated when it
  // was created, so we don't re-check here — we just retry the gateway call.
  const existingPending = order.payment.refunds.find(r => r.status === REFUND_STATUS.PENDING);
  if (existingPending) {
    let gatewayRef = existingPending.gatewayRef;
    let refundStatus = REFUND_STATUS.PENDING;
    try {
      const client = await getOutletRazorpayClient(order.outletId);
      const gatewayRefund = await client.payments.refund(order.payment.razorpayPaymentId, {
        amount: toPaise(existingPending.amount),
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
      // INO-AUDIT4-D2 fix: only mark Payment=REFUNDED if fully refunded.
      await markPaymentRefundedIfFullyRefunded(order.payment.id);
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

  // Fresh manual refund path. Amount has been validated above against
  // the remaining refundable cap.
  //
  // INO-AUDIT6-#5 fix: concurrent refund race. The previous implementation
  // did the remaining-check + Refund.create as separate writes — two
  // concurrent requests could both see remaining=₹1000 and both create
  // ₹700 refunds → ₹1400 refunded on a ₹1000 payment. Fix: wrap the
  // remaining-check + Refund.create in a prisma.$transaction with a
  // SELECT FOR UPDATE on the Payment row (Postgres; SQLite serializes
  // writes automatically). The gateway call stays post-commit (same
  // outbox pattern as the transition service). If the gateway call
  // fails, the Refund row stays PENDING + gatewayRef=NULL → the outbox
  // worker picks it up.
  const refund = await prisma.$transaction(async (tx) => {
    // Lock the payment row (Postgres only; SQLite serializes automatically)
    if (isPostgres()) {
      await tx.$queryRaw`SELECT * FROM "Payment" WHERE id = ${order.payment.id} FOR UPDATE`;
    }
    // Re-read the refunds INSIDE the tx (so we see the locked state)
    const txRefunds = await tx.refund.findMany({ where: { paymentId: order.payment.id } });
    const txRemaining = remainingRefundable(order.payment.amount, txRefunds);
    if (requestedAmount > txRemaining) {
      throw {
        statusCode: 400,
        code: 'REFUND_AMOUNT_EXCEEDS_REMAINING',
        message: `Refund amount ₹${requestedAmount.toFixed(2)} exceeds remaining refundable amount ₹${txRemaining.toFixed(2)} (concurrent refund may have been processed).`,
      };
    }
    // Create the Refund row INSIDE the tx (outbox message)
    return tx.refund.create({
      data: {
        paymentId: order.payment.id,
        amount,
        reason,
        gatewayRef: null, // filled post-commit if gateway call succeeds
        status: REFUND_STATUS.PENDING,
        triggeredBy: REFUND_TRIGGER.SUPER_ADMIN_MANUAL,
        initiatedBy: actorId,
      },
    });
  });

  // Post-commit: best-effort gateway call. If it fails, the Refund stays
  // PENDING + gatewayRef=NULL → the outbox worker picks it up.
  let gatewayRef = null;
  let refundStatus = REFUND_STATUS.PENDING;
  try {
    const client = await getOutletRazorpayClient(order.outletId);
    const gatewayRefund = await client.payments.refund(order.payment.razorpayPaymentId, {
      amount: toPaise(refund.amount),
      notes: {
        orderId: order.id,
        trigger: REFUND_TRIGGER.SUPER_ADMIN_MANUAL,
        reason,
      },
    });
    gatewayRef = gatewayRefund.id;
    refundStatus = (gatewayRefund.status || 'PENDING').toUpperCase();
  } catch (err) {
    console.error('[admin:refund] post-commit gateway call failed:', err.message);
    // The outbox worker will retry automatically on its next tick.
  }

  // Update the Refund row with the gateway result (if the call succeeded)
  if (gatewayRef) {
    await prisma.refund.update({
      where: { id: refund.id },
      data: { gatewayRef, status: refundStatus },
    });
  }

  if (refundStatus === REFUND_STATUS.COMPLETED || refundStatus === 'PROCESSED') {
    await markPaymentRefundedIfFullyRefunded(order.payment.id);
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
  createOutlet,
  getAllStaff,
  updateOutletStatus,
  getOrders,
  getOrder,
  getMenu,
  getMenuItem,
  updateMenuItemStatus,
  issueManualRefund,
};
