import client from './client';

export const notificationService = {
  // GET /notifications — paginated envelope { items, total, unreadCount, page, pageSize }
  list: async ({ page = 1, pageSize = 20, unread } = {}) => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (unread !== undefined) params.set('unread', String(unread));
      const response = await client.get(`/notifications?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  markAllRead: async () => {
    try {
      const response = await client.post('/notifications/read/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  markRead: async (notificationId) => {
    try {
      const response = await client.post(`/notifications/read/${notificationId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  }
};
