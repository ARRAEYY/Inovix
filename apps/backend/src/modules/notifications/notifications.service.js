/**
 * Notification service — DB-persisted + socket-emitted notifications.
 *
 * Spec ref: §4 entity #17 + §6.2 realtime strategy.
 *
 * The notifications module creates a Notification row (the source of truth)
 * and emits a notification:created event over Socket.IO (a side-channel for
 * real-time UX). If the event is lost (socket disconnect), the row is still
 * there for the bell icon to pick up via GET /api/v1/notifications.
 */

const prisma = require('../../lib/prisma');
const { emitNotificationEvent } = require('../../lib/socket');
const { cacheDelPrefix, cached } = require('../../lib/cache');
const { NOTIFICATION_TYPE } = require('../../lib/constants');

// List reads are cached per user for 60s; every write (create, mark read,
// mark all read) invalidates that user's keys, so the cache only shortens
// the read path and never serves stale data after a write.
const LIST_CACHE_TTL = 60;

const listCacheKey = (userId, { page, pageSize, unreadOnly }) =>
  `notif:u:${userId}:p${page}:s${pageSize}:r${unreadOnly ? 1 : 0}`;

const invalidateUser = (userId) => cacheDelPrefix(`notif:u:${userId}:`);

const TYPE_TEMPLATES = {
  [NOTIFICATION_TYPE.ORDER_ACCEPTED]: { title: 'Order accepted',   message: (o) => `${o.outletSnapshot?.name || 'Outlet'} accepted your order ${o.orderNumber}.` },
  [NOTIFICATION_TYPE.ORDER_PREPARING]:{ title: 'Preparing',         message: (o) => `Your order ${o.orderNumber} is being prepared.` },
  [NOTIFICATION_TYPE.ORDER_READY]:     { title: 'Ready for pickup', message: (o) => `Order ${o.orderNumber} is ready. Use pickup code ${o.pickupCode}.` },
  [NOTIFICATION_TYPE.ORDER_COMPLETED]: { title: 'Order completed',  message: (o) => `Order ${o.orderNumber} is completed. Thank you!` },
  [NOTIFICATION_TYPE.ORDER_REJECTED]:  { title: 'Order rejected',   message: (o) => `Order ${o.orderNumber} was rejected. A full refund will be issued.` },
  [NOTIFICATION_TYPE.ORDER_CANCELLED]: { title: 'Order cancelled',  message: (o) => `Order ${o.orderNumber} was cancelled.` },
};

/**
 * Create a notification row + emit socket event for the student attached
 * to the order, based on the order's new status.
 *
 * @param {Object} order — order object (post-transition)
 * @param {string} actorId — user id of the actor who triggered the transition
 */
async function createForOrder(order, actorId) {
  const statusToType = {
    ACCEPTED:  NOTIFICATION_TYPE.ORDER_ACCEPTED,
    PREPARING: NOTIFICATION_TYPE.ORDER_PREPARING,
    READY:     NOTIFICATION_TYPE.ORDER_READY,
    COMPLETED: NOTIFICATION_TYPE.ORDER_COMPLETED,
    REJECTED:  NOTIFICATION_TYPE.ORDER_REJECTED,
    CANCELLED: NOTIFICATION_TYPE.ORDER_CANCELLED,
  };

  const type = statusToType[order.status];
  if (!type) return null;

  const template = TYPE_TEMPLATES[type];
  const notification = await prisma.notification.create({
    data: {
      userId: order.studentId,
      type,
      title: template.title,
      message: template.message(order),
      payload: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber, pickupCode: order.pickupCode }),
      orderId: order.id,
    },
  });

  emitNotificationEvent(order.studentId, notification);
  await invalidateUser(order.studentId);

  return notification;
}

/**
 * Paginated list of notifications for the current user (Redis-cached).
 */
async function listForUser(userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
  return cached(listCacheKey(userId, { page, pageSize, unreadOnly }), LIST_CACHE_TTL, async () => {
    const where = { userId };
    if (unreadOnly) where.isRead = false;
    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, total, unreadCount, page, pageSize };
  });
}

async function markRead(userId, notificationId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== userId) {
    throw { statusCode: 404, message: 'Notification not found' };
  }
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
  await invalidateUser(userId);
  return updated;
}

async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  await invalidateUser(userId);
  return result.count;
}

module.exports = {
  createForOrder,
  listForUser,
  markRead,
  markAllRead,
  // Exported for reuse by the transition service (architectural refactor —
  // single transactional order-transition service owns notification
  // creation inside the same tx as the order update).
  NOTIFICATION_TEMPLATES: TYPE_TEMPLATES,
};
