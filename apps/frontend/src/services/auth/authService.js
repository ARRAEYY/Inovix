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
   * Logs out — revokes the refresh token server-side (POST /auth/logout)
   * and clears the local session.
   */
  async logout() {
    try {
      await client.post('/auth/logout');
    } catch (error) {
      // Logout must always succeed locally even if the server call fails
      // (e.g. already-expired access token).
      console.error('Server logout failed:', error.response?.data?.message || error.message);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  },

  /**
   * Fetches the current user profile (GET /auth/me) — includes the
   * studentProfile (college ID, course, year, phone) for students.
   */
  async getProfile() {
    try {
      const response = await client.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  /**
   * Updates the user profile
   * @param {Object} data - Profile data (name, avatar)
   */
  async updateProfile(data) {
    try {
      const response = await client.put('/auth/me', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Network Error' };
    }
  }
};
