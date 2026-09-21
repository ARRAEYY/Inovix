import client from '../api/client';

export const adminService = {
  async getOverview() {
    const res = await client.get('/admin/overview');
    return res.data.data;
  },

  async listUsers({ page, pageSize } = {}) {
    const res = await client.get('/admin/users', { params: { page, pageSize } });
    return res.data.data;
  },

  async getUser(userId) {
    const res = await client.get(`/admin/users/${userId}`);
    return res.data.data;
  },

  async updateUserStatus(userId, status) {
    const res = await client.patch(`/admin/users/${userId}/status`, { status });
    return res.data.data;
  },

  async listOutlets() {
    const res = await client.get('/admin/outlets');
    return res.data.data;
  },

  async updateOutletStatus(outletId, status) {
    const res = await client.patch(`/admin/outlets/${outletId}/status`, { status });
    return res.data.data;
  },

  async listOrders({ page, pageSize } = {}) {
    const res = await client.get('/admin/orders', { params: { page, pageSize } });
    return res.data.data;
  },

  async listMenu() {
    const res = await client.get('/admin/menu');
    return res.data.data;
  },

  async updateMenuAvailability(itemId, isAvailable) {
    const res = await client.patch(`/admin/menu/${itemId}/status`, { isAvailable });
    return res.data.data;
  },

  async listAudit({ page, pageSize, targetType, targetId, actorUserId, action } = {}) {
    const res = await client.get('/audit', { params: { page, pageSize, targetType, targetId, actorUserId, action } });
    return res.data.data;
  },
};
