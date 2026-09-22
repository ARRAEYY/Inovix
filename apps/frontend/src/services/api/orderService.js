import client from './client';

export const orderService = {
  getOutletOrders: async () => {
    try {
      const response = await client.get('/outlet/orders');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  updateOrderStatus: async (orderId, status, additionalData = {}) => {
    try {
      const response = await client.patch(`/outlet/orders/${orderId}/status`, { status, ...additionalData });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  }
};
