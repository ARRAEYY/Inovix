const mockUsers = require('../../data/mockUsers');
const { outlets } = require('../../data/mockData');
const { ROLES, OUTLET_STATUS, USER_STATUS } = require('../../lib/constants');
const menuRepo = require('../menu/menu.repository');
const ordersRepo = require('../orders/orders.repository');

const getOverview = async () => {
  const allMenu = await menuRepo.findAll();
  const allOrders = await ordersRepo.findAll ? await ordersRepo.findAll() : []; // I will add findAll to ordersRepo

  return {
    users: {
      students: mockUsers.filter(u => u.role === ROLES.STUDENT).length,
      outletAdmins: mockUsers.filter(u => u.role === ROLES.OUTLET_ADMIN).length,
      outletStaff: mockUsers.filter(u => u.role === ROLES.OUTLET_STAFF).length,
      superAdmins: mockUsers.filter(u => u.role === ROLES.SUPER_ADMIN).length,
      total: mockUsers.length
    },
    outlets: {
      total: outlets.length,
      open: outlets.filter(o => o.status === 'OPEN').length,
      busy: outlets.filter(o => o.status === 'BUSY').length,
      closed: outlets.filter(o => o.status === 'CLOSED').length
    },
    menu: {
      total: allMenu.length,
      available: allMenu.filter(m => m.isAvailable).length,
      unavailable: allMenu.filter(m => !m.isAvailable).length
    },
    orders: {
      total: allOrders.length,
      placed: allOrders.filter(o => o.status === 'PLACED').length,
      preparing: allOrders.filter(o => o.status === 'PREPARING').length,
      ready: allOrders.filter(o => o.status === 'READY').length,
      completed: allOrders.filter(o => o.status === 'COMPLETED').length,
      cancelled: allOrders.filter(o => o.status === 'CANCELLED').length
    }
  };
};

const getUsers = async () => {
  return mockUsers.map(({ passwordHash, ...user }) => user);
};

const getUser = async (userId) => {
  const user = mockUsers.find(u => u.id === userId);
  if (!user) throw { status: 404, message: 'User not found' };
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const updateUserStatus = async (userId, status, reqUserId) => {
  if (userId === reqUserId) {
    throw { status: 400, message: 'Super Admins cannot suspend themselves' };
  }
  
  if (![USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED].includes(status)) {
    throw { status: 400, message: 'Invalid status' };
  }

  const user = mockUsers.find(u => u.id === userId);
  if (!user) throw { status: 404, message: 'User not found' };

  user.status = status;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const getOutlets = async () => {
  return outlets;
};

const getOutlet = async (outletId) => {
  const outlet = outlets.find(o => o.id === outletId);
  if (!outlet) throw { status: 404, message: 'Outlet not found' };
  return outlet;
};

const updateOutletStatus = async (outletId, status) => {
  if (!Object.values(OUTLET_STATUS).includes(status)) {
    throw { status: 400, message: `Invalid status. Must be one of: ${Object.values(OUTLET_STATUS).join(', ')}` };
  }

  const outlet = outlets.find(o => o.id === outletId);
  if (!outlet) throw { status: 404, message: 'Outlet not found' };

  outlet.status = status;
  return outlet;
};

const getOrders = async () => {
  return await ordersRepo.findAll();
};

const getOrder = async (orderId) => {
  const order = await ordersRepo.findById(orderId);
  if (!order) throw { status: 404, message: 'Order not found' };
  return order;
};

const getMenu = async () => {
  return await menuRepo.findAll();
};

const getMenuItem = async (itemId) => {
  const item = await menuRepo.findById(itemId);
  if (!item) throw { status: 404, message: 'Menu item not found' };
  return item;
};

const updateMenuItemStatus = async (itemId, isAvailable) => {
  if (typeof isAvailable !== 'boolean') {
    throw { status: 400, message: 'isAvailable must be a boolean' };
  }

  const item = await menuRepo.findById(itemId);
  if (!item) throw { status: 404, message: 'Menu item not found' };

  // Only update isAvailable
  return await menuRepo.update(itemId, { isAvailable });
};

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
  updateMenuItemStatus
};
