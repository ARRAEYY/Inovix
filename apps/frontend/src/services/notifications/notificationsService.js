import client from '../api/client';

export const notificationsService = {
  async list({ page, pageSize, unread } = {}) {
    const res = await client.get('/notifications', { params: { page, pageSize, unread: unread ? 'true' : undefined } });
    return res.data.data;
  },

  async markRead(notificationId) {
    const res = await client.post(`/notifications/read/${notificationId}`);
    return res.data.data;
  },

  async markAllRead() {
    const res = await client.post('/notifications/read/all');
    return res.data.data;
  },
};
