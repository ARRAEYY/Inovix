import client, { setTokens, clearTokens, setOnAuthFailed, getAccessToken, getRefreshToken } from '../api/client';

export const authService = {
  /**
   * Dev login (non-production). Used for local testing only.
   */
  async devLogin(email, password) {
    const res = await client.post('/auth/dev-login', { email, password });
    if (res.data.success) {
      const { user, accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      return { user, accessToken, refreshToken };
    }
    throw new Error(res.data.message || 'Dev login failed');
  },

  /**
   * Google Sign-In. `credential` is the Google ID token from Google Identity Services.
   */
  async googleLogin(credential) {
    const res = await client.post('/auth/google', { credential });
    if (res.data.success) {
      const { user, accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      return { user, accessToken, refreshToken };
    }
    throw new Error(res.data.message || 'Google login failed');
  },

  /**
   * Fetch the current user (requires auth). Uses the access token in the
   * client's memory store; the interceptor auto-refreshes if it's expired.
   */
  async me() {
    const res = await client.get('/auth/me');
    return res.data.data.user;
  },

  /**
   * Logout: revoke the refresh token on the backend + clear local state.
   */
  async logout() {
    try {
      await client.post('/auth/logout', { refreshToken: getRefreshToken() });
    } catch (e) {
      // Even if the server call fails (network error, expired token), clear local state
    }
    clearTokens();
  },

  setOnAuthFailed,
  getAccessToken,
  getRefreshToken,
};
