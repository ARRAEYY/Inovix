import client from './client';

export const catalogService = {
  getOutlets: async () => {
    try {
      const response = await client.get('/catalog/outlets');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  getOutletDetails: async (outletId) => {
    try {
      const response = await client.get(`/catalog/outlets/${outletId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  getOutletMenu: async (outletId) => {
    try {
      const response = await client.get(`/catalog/outlets/${outletId}/menu`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  }
};
