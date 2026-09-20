import client from '../api/client';

export const authService = {
  /**
   * Login using the dev-login route.
   * @param {string} email
   * @param {string} password 
   */
  async login(email, password) {
    try {
      const response = await client.post('/auth/dev-login', { email, password });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  /**
   * Logs out the user (client side clearance is usually enough for JWT unless there's a backend endpoint)
   */
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }
};
