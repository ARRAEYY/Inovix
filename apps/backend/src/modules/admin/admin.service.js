/**
 * Super-admin service — platform-wide overview, user mgmt, outlet mgmt.
 *
 * All endpoints require SUPER_ADMIN role (enforced in routes).
 */

const prisma = require('../../lib/prisma');
const menuRepo = require('../menu/menu.repository');
const ordersRepo = require('../orders/orders.repository');
const { ROLES, OUTLET_STATUS, USER_STATUS } = require('../../lib/constants');

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
};
