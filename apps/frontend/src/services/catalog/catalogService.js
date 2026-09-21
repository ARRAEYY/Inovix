import client from '../api/client';

export const catalogService = {
  async getOutlets() {
    const res = await client.get('/catalog/outlets');
    return res.data.data;
  },

  async getOutlet(id) {
    const res = await client.get(`/catalog/outlets/${id}`);
    return res.data.data;
  },

  async getOutletMenu(outletId) {
    const res = await client.get(`/catalog/outlets/${outletId}/menu`);
    return res.data.data;
  },

  async getCategories(outletId) {
    const res = await client.get(`/catalog/outlets/${outletId}/categories`);
    return res.data.data;
  },

  async getPopular() {
    const res = await client.get('/catalog/menu/popular');
    return res.data.data;
  },

  async search(q) {
    const res = await client.get('/catalog/search', { params: { q } });
    return res.data.data;
  },
};
