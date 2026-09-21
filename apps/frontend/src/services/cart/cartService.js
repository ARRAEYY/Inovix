import client from '../api/client';

export const cartService = {
  async getActiveCart() {
    const res = await client.get('/cart');
    return res.data.data;
  },

  async getTotals() {
    const res = await client.get('/cart/totals');
    return res.data.data;
  },

  async clearCart() {
    const res = await client.delete('/cart');
    return res.data;
  },

  async getOrCreateForOutlet(outletId) {
    const res = await client.get(`/cart/outlets/${outletId}`);
    return res.data.data;
  },

  async addItem(outletId, { menuItemId, quantity, selectedOptions }) {
    const res = await client.post(`/cart/outlets/${outletId}/items`, {
      menuItemId, quantity, selectedOptions,
    });
    return res.data.data;
  },

  async updateItem(cartItemId, quantity) {
    const res = await client.patch(`/cart/items/${cartItemId}`, { quantity });
    return res.data.data;
  },

  async removeItem(cartItemId) {
    const res = await client.delete(`/cart/items/${cartItemId}`);
    return res.data.data;
  },
};
