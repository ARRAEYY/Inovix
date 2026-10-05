import client from '../api/client';

export const authService = {
  /**
   * Login using the standard production route.
   * @param {string} email
   * @param {string} password 
   */
  async login(email, password) {
    try {
      const response = await client.post('/auth/login', { email, password });
      return response.data;
    } catch (error) {
      if (import.meta.env.DEV && error.response?.status === 404) {
        try {
          const devRes = await client.post('/auth/dev-login', { email, password });
          return devRes.data;
        } catch {}
      }
      throw error.response?.data || { message: 'Network Error' };
    }
  },

  /**
   * Logs out — revokes the refresh token server-side (POST /auth/logout),
   * revokes Google OAuth credentials, and clears all local session data.
   * @param {Object} [user] - Optional user object to revoke Google session for
   */
  async logout(user) {
    try {
      await client.post('/auth/logout');
    } catch (error) {
      console.error('Server logout failed:', error.response?.data?.message || error.message);
    }

    // Revoke Google OAuth session and disable auto-select
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
        const email = user?.email || JSON.parse(localStorage.getItem('user') || '{}')?.email;
        if (email) {
          window.google.accounts.id.revoke(email, (done) => {
            console.log('Google token revoked:', done.successful);
          });
        }
      }
    } catch (e) {
      console.warn('Google revoke error:', e);
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    sessionStorage.clear();
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
