import client from './client';

// Backend order statuses (orderStatusEnum) → display vocabulary used by
// the outlet board UI (NEW / PREPARING / READY columns).
export const OUTLET_DISPLAY_STATUS = {
  PENDING: 'NEW',
  ACCEPTED: 'PREPARING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

export const orderService = {
  // ─── Student ────────────────────────────────────────────────────────────
  getMyOrders: async () => {
    try {
      const response = await client.get('/orders');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  createOrder: async ({ outletId, items, notes, scheduledFor }) => {
    try {
      const response = await client.post('/orders', {
        outletId,
        items,
        paymentMethod: 'ONLINE',
        ...(notes ? { notes } : {}),
        ...(scheduledFor ? { scheduledFor } : {}),
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  // ─── Cancel order (student, while PENDING — triggers auto-refund) ───
  cancelOrder: async (orderId) => {
    try {
      const response = await client.post(`/orders/${orderId}/cancel`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  // ─── Outlet (staff + admin) ────────────────────────────────────────────
  getOutletOrders: async () => {
    try {
      const response = await client.get('/outlet/orders');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  // `reason` maps to the backend's updateOrderStatusSchema ({status, reason});
  // rejections use status 'REJECTED' (the backend enum has no 'DECLINED').
  updateOrderStatus: async (orderId, status, reason) => {
    try {
      const response = await client.patch(`/outlet/orders/${orderId}/status`, {
        status,
        ...(reason ? { reason } : {}),
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },
};
