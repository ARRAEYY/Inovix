import client from '../api/client';

export const menuService = {
  async listMyOutletMenu() {
    const res = await client.get('/outlet/menu');
    return res.data.data;
  },

  async getMenuItem(itemId) {
    const res = await client.get(`/outlet/menu/${itemId}`);
    return res.data.data;
  },

  async createMenuItem(data) {
    const res = await client.post('/outlet/menu', data);
    return res.data.data;
  },

  async updateMenuItem(itemId, data) {
    const res = await client.patch(`/outlet/menu/${itemId}`, data);
    return res.data.data;
  },

  async deleteMenuItem(itemId) {
    const res = await client.delete(`/outlet/menu/${itemId}`);
    return res.data;
  },
};
