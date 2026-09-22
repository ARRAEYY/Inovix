import client from './client';

export const menuService = {
  getOutletMenu: async () => {
    try {
      const response = await client.get('/outlet/menu');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  createMenuItem: async (itemData) => {
    try {
      const response = await client.post('/outlet/menu', itemData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  updateMenuItem: async (itemId, itemData) => {
    try {
      const response = await client.patch(`/outlet/menu/${itemId}`, itemData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  updateAvailability: async (itemId, available) => {
    try {
      const response = await client.patch(`/outlet/menu/${itemId}/availability`, { available });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  deleteMenuItem: async (itemId) => {
    try {
      const response = await client.delete(`/outlet/menu/${itemId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  }
};
