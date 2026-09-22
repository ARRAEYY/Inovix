const mockUsers = require('../../data/mockUsers');
const { outlets } = require('../../data/mockData');
const { ROLES, OUTLET_STATUS, USER_STATUS } = require('../../lib/constants');
const menuRepo = require('../menu/menu.repository');
const ordersRepo = require('../orders/orders.repository');

const getOverview = async () => {
  const allMenu = await menuRepo.findAll();
  const allOrders = await ordersRepo.findAll ? await ordersRepo.findAll() : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const ordersToday = allOrders.filter(o => new Date(o.createdAt) >= today);
  const ordersThisWeek = allOrders.filter(o => new Date(o.createdAt) >= startOfWeek);
  const ordersThisMonth = allOrders.filter(o => new Date(o.createdAt) >= startOfMonth);
  
  const revenueToday = ordersToday
    .filter(o => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.total, 0);

  const revenueThisMonth = ordersThisMonth
    .filter(o => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.total, 0);

  const revenueTotal = allOrders
    .filter(o => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.total, 0);

  // Build the detailed outlet overview
  const outletOverview = outlets.map(outlet => {
    const outletOrders = ordersToday.filter(o => o.outletId === outlet.id);
    const outletStaff = mockUsers.filter(u => u.outletId === outlet.id && u.role === ROLES.OUTLET_STAFF).length;
    return {
      ...outlet,
      ordersToday: outletOrders.length,
      staffCount: outletStaff
    };
  });

  // Recent orders with populated user/outlet data
  const recentOrders = allOrders
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(order => {
      const user = mockUsers.find(u => u.id === order.userId);
      const outlet = outlets.find(o => o.id === order.outletId);
      return {
        ...order,
        studentName: user ? user.name : 'Unknown',
        outletName: outlet ? outlet.name : 'Unknown Outlet'
      };
    });

  // Mocked pending actions
  const attentionNeeded = [
    { id: 1, type: 'warning', message: '3 outlet approval requests', action: 'Review', path: '/admin/outlets' },
    { id: 2, type: 'error', message: '2 suspended outlets', action: 'Manage', path: '/admin/outlets' },
    { id: 3, type: 'info', message: '5 staff access requests', action: 'View', path: '/admin/staff' }
  ];

  return {
    metrics: {
      totalOutlets: outlets.length,
      activeOutlets: outlets.filter(o => ['OPEN', 'BUSY'].includes(o.status)).length,
      totalUsers: mockUsers.length,
      ordersToday: ordersToday.length,
      ordersThisWeek: ordersThisWeek.length,
      revenueToday,
      revenueThisMonth,
      revenueTotal,
      activeStaff: mockUsers.filter(u => u.role === ROLES.OUTLET_STAFF && u.status === USER_STATUS.ACTIVE).length,
      pendingRequests: 3
    },
    users: {
      students: mockUsers.filter(u => u.role === ROLES.STUDENT).length,
      outletAdmins: mockUsers.filter(u => u.role === ROLES.OUTLET_ADMIN).length,
      outletStaff: mockUsers.filter(u => u.role === ROLES.OUTLET_STAFF).length,
      superAdmins: mockUsers.filter(u => u.role === ROLES.SUPER_ADMIN).length,
    },
    outletOverview,
    recentOrders,
    attentionNeeded
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
  const allOrders = await ordersRepo.findAll ? await ordersRepo.findAll() : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ordersToday = allOrders.filter(o => new Date(o.createdAt) >= today);

  return outlets.map(outlet => {
    const outletOrders = ordersToday.filter(o => o.outletId === outlet.id);
    const outletStaff = mockUsers.filter(u => u.outletId === outlet.id && u.role === ROLES.OUTLET_STAFF).length;
    return {
      ...outlet,
      ordersToday: outletOrders.length,
      staffCount: outletStaff
    };
  });
};

const createOutlet = async (outletData) => {
  const newOutlet = {
    id: `outlet-${Date.now()}`,
    ...outletData,
    status: outletData.status || 'OPEN',
    createdAt: new Date().toISOString()
  };
  outlets.push(newOutlet);
  return newOutlet;
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
  createOutlet,
  getOutlet,
  updateOutletStatus,
  getOrders,
  getOrder,
  getMenu,
  getMenuItem,
  updateMenuItemStatus
};
