import api from './api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Outlet-admin service — wired to the backend's existing outlet-scoped
// endpoints (/outlet/orders, /outlet/menu, /outlet/staff). All functions
// return the API envelope ({ success, data, message }) — callers read `.data`.
// ─────────────────────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  // GET /outlet/orders/analytics returns:
  //   { todaySales, monthSales, totalOrders, prepTime: '12 min',
  //     weeklyOrders: [{ day: 'Mon', date, value }],
  //     popularItems, attentionNeeded: [{ type, message, action }],
  //     recentOrders: [{ id, orderNumber, status, total, studentName, outletName }] }
  // This maps it onto the dashboard's expected stats shape (no UI change).
  const response = await api.get('/outlet/orders/analytics');
  const d = response.data?.data || {};

  const alertColor = { warning: '#f59e0b', success: '#10b981', error: '#b10035' };

  return {
    data: {
      todaySales: d.todaySales ?? 0,
      totalOrders: d.totalOrders ?? 0,
      monthSales: d.monthSales ?? 0,
      prepTime: typeof d.prepTime === 'string'
        ? { value: d.prepTime, subtitle: 'Average today' }
        : d.prepTime,
      // The chart highlights index 4 (Friday) via `item.day === 'F'` —
      // send single-letter day labels to keep that accent working.
      weeklyOrders: (d.weeklyOrders || []).map((w) => ({ ...w, day: (w.day || '?').charAt(0) })),
      attentionNeeded: (d.attentionNeeded || []).map((a) => ({
        ...a,
        color: alertColor[a.type] || '#6b7280',
      })),
      recentOrders: (d.recentOrders || []).map((o) => ({ ...o })),
    },
  };
};

export const getOrders = async () => {
  const response = await api.get('/outlet/orders');
  return response.data;
};

export const getMenu = async () => {
  const response = await api.get('/outlet/menu');
  return response.data;
};

export const createMenuItem = async (itemData) => {
  const response = await api.post('/outlet/menu', itemData);
  return response.data;
};

export const updateMenuItem = async (itemId, itemData) => {
  const response = await api.patch(`/outlet/menu/${itemId}`, itemData);
  return response.data;
};

export const deleteMenuItem = async (itemId) => {
  const response = await api.delete(`/outlet/menu/${itemId}`);
  return response.data;
};

export const updateMenuAvailability = async (itemId, isAvailable) => {
  const response = await api.patch(`/outlet/menu/${itemId}/availability`, { isAvailable });
  return response.data;
};

export const getStaff = async () => {
  const response = await api.get('/outlet/staff');
  return response.data;
};

export const createStaff = async (staffData) => {
  const response = await api.post('/outlet/staff', staffData);
  return response.data;
};

export const updateStaffStatus = async (staffId, status) => {
  const response = await api.patch(`/outlet/staff/${staffId}/status`, { status });
  return response.data;
};
