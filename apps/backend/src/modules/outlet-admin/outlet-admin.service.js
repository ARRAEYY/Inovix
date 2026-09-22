const ordersService = require('../orders/orders.service');
const menuService = require('../menu/menu.service');
const mockUsers = require('../../data/mockUsers');

// ── Dashboard Statistics ──────────────────────────────────────────────────────

const getDashboardStats = async (outletId) => {
  const orders = await ordersService.getOutletOrders(outletId);
  const menu = await menuService.getOutletMenu(outletId);

  // Current orders are active ones
  const currentOrders = orders.filter(o => ['PLACED', 'PREPARING', 'READY'].includes(o.status));
  
  // Today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySales = orders
    .filter(o => o.status === 'COMPLETED' && new Date(o.createdAt) >= today)
    .reduce((sum, o) => sum + o.total, 0);

  // This month sales
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthSales = orders
    .filter(o => o.status === 'COMPLETED' && new Date(o.createdAt) >= startOfMonth)
    .reduce((sum, o) => sum + o.total, 0);

  // Popular items
  const itemCounts = {};
  orders.filter(o => o.status === 'COMPLETED').forEach(order => {
    order.items.forEach(item => {
      itemCounts[item.menuItemId] = (itemCounts[item.menuItemId] || 0) + item.quantity;
    });
  });

  const popularItems = Object.keys(itemCounts)
    .map(id => {
      const menuItem = menu.find(m => m.id === id);
      return {
        id,
        name: menuItem ? menuItem.name : 'Unknown Item',
        orders: itemCounts[id]
      };
    })
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 3); // top 3

  // Staff overview
  const staff = mockUsers.filter(u => u.outletId === outletId && u.role === 'OUTLET_STAFF');
  const activeStaffCount = staff.filter(s => s.status === 'ACTIVE').length;
  const inactiveStaffCount = staff.length - activeStaffCount;

  return {
    currentOrdersCount: currentOrders.length,
    todaySales,
    monthSales,
    totalOrders: orders.length,
    currentOrdersBreakdown: {
      new: currentOrders.filter(o => o.status === 'PLACED').length,
      preparing: currentOrders.filter(o => o.status === 'PREPARING').length,
      ready: currentOrders.filter(o => o.status === 'READY').length,
    },
    popularItems,
    recentOrders: orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    currentOrders: currentOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    staffOverview: {
      total: staff.length,
      active: activeStaffCount,
      inactive: inactiveStaffCount
    },
    // Mock data for the new dashboard UI
    percentChange: {
      sales: "+14.2%",
      orders: "+9.1%",
      monthSales: "+4.3%"
    },
    averageOrder: 259,
    prepTime: {
      value: "14 min",
      subtitle: "2 min faster"
    },
    weeklyOrders: [
      { day: 'M', value: 30 },
      { day: 'T', value: 40 },
      { day: 'W', value: 50 },
      { day: 'T', value: 45 },
      { day: 'F', value: 90 },
      { day: 'S', value: 60 },
      { day: 'S', value: 25 }
    ],
    attentionNeeded: [
      { type: 'warning', message: '3 menu items unavailable', action: 'Update stock', color: '#F5A623' },
      { type: 'error', message: '2 refunds awaiting review', action: 'Review', color: '#b10035' },
      { type: 'success', message: 'All systems operational', action: 'View status', color: '#16a34a' }
    ]
  };
};

// ── Orders ────────────────────────────────────────────────────────────────────

const getOrders = async (outletId) => {
  return await ordersService.getOutletOrders(outletId);
};

// ── Menu Management ───────────────────────────────────────────────────────────

const getMenu = async (outletId) => {
  return await menuService.getOutletMenu(outletId);
};

const createMenuItem = async (outletId, payload) => {
  return await menuService.createMenuItem(outletId, payload);
};

const updateMenuItem = async (outletId, itemId, payload) => {
  return await menuService.updateMenuItem(outletId, itemId, payload);
};

const deleteMenuItem = async (outletId, itemId) => {
  return await menuService.deleteMenuItem(outletId, itemId);
};

const updateMenuAvailability = async (outletId, itemId, isAvailable) => {
  return await menuService.updateAvailability(outletId, itemId, isAvailable);
};

// ── Staff Management ──────────────────────────────────────────────────────────

const getStaff = async (outletId) => {
  // Return all staff for this outlet
  return mockUsers
    .filter(u => u.outletId === outletId && u.role === 'OUTLET_STAFF')
    .map(u => {
      const { passwordHash, ...safeUser } = u;
      return safeUser;
    });
};

const createStaff = async (outletId, payload) => {
  // In a real app we'd hash the password and store in DB
  const newStaff = {
    id: `staff-${Date.now()}`,
    name: payload.name,
    email: payload.email,
    phone: payload.phone || null,
    role: 'OUTLET_STAFF',
    outletId: outletId,
    onboardingCompleted: true,
    passwordHash: 'mock-hash', // fake hash for mock
    status: 'ACTIVE'
  };
  mockUsers.push(newStaff);
  
  const { passwordHash, ...safeUser } = newStaff;
  return safeUser;
};

const getStaffMember = async (outletId, staffId) => {
  const staff = mockUsers.find(u => u.id === staffId && u.outletId === outletId);
  if (!staff) {
    throw { status: 404, message: 'Staff member not found' };
  }
  const { passwordHash, ...safeUser } = staff;
  return safeUser;
};

const updateStaffStatus = async (outletId, staffId, status) => {
  const staff = mockUsers.find(u => u.id === staffId && u.outletId === outletId);
  if (!staff) {
    throw { status: 404, message: 'Staff member not found' };
  }
  if (staff.role !== 'OUTLET_STAFF') {
    throw { status: 403, message: 'Cannot modify non-staff users' };
  }
  
  staff.status = status; // 'ACTIVE' or 'SUSPENDED' (we use SUSPENDED for inactive)
  
  const { passwordHash, ...safeUser } = staff;
  return safeUser;
};

module.exports = {
  getDashboardStats,
  getOrders,
  getMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  updateMenuAvailability,
  getStaff,
  createStaff,
  getStaffMember,
  updateStaffStatus
};
