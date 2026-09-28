import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add a request interceptor to attach the auth token if available
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a response interceptor to handle global errors (like 401 Unauthorized).
// On a 401 (expired 15-min access token) we try ONE refresh round-trip — the
// backend rotates the httpOnly `nosh_refresh` cookie and returns a fresh
// access token — then replay the original request. If the refresh also
// fails, the stale local session is cleared and the error propagates.
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios.post(
      `${client.defaults.baseURL}/auth/refresh`,
      {},
      { withCredentials: true }
    ).then((response) => {
      const { accessToken } = response.data?.data || {};
      if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
      }
      return accessToken || null;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

client.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  const originalRequest = error.config;
  const status = error.response?.status;

  if (status === 401 && originalRequest && !originalRequest._retriedAfterRefresh) {
    // Never retry the refresh call itself or the auth endpoints — a bad
    // credential must fail fast, not loop.
    const url = originalRequest.url || '';
    const isAuthCall = url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/dev-login') || url.includes('/auth/google');

    if (!isAuthCall) {
      originalRequest._retriedAfterRefresh = true;
      try {
        const accessToken = await refreshAccessToken();
        if (accessToken) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return client(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed — the session is genuinely over. Clear the stale
        // identity so protected routes redirect to login on next render.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        console.error('Authentication Error: session expired, please log in again');
        return Promise.reject(refreshError);
      }
    }
  }

  if (status === 401) {
    console.error('Authentication Error: 401 Unauthorized');
  }
  return Promise.reject(error);
});

export default client;
