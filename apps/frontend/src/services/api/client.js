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
        // Notify the AuthContext so it clears React state + triggers a
        // redirect to login. Without this, the user stays on a protected
        // page seeing error toasts on every API call.
        window.dispatchEvent(new Event('nosh:session-expired'));
        console.error('Authentication Error: session expired, please log in again');
        return Promise.reject(refreshError);
      }
    }
  }

  if (status === 401) {
    console.error('Authentication Error: 401 Unauthorized');
  }
  // Normalize error messages so toast() calls show user-friendly text
  // instead of raw axios error objects.
  const normalizedError = new Error(
    error.response?.data?.message ||
    error.response?.data?.errors?.[0]?.message ||
    (status === 0 ? 'Network error — check your connection' :
     status === 403 ? 'You don\'t have permission to do this' :
     status === 404 ? 'Not found' :
     status >= 500 ? 'Server error — please try again' :
     'Request failed')
  );
  normalizedError.response = error.response;
  normalizedError.status = status;
  return Promise.reject(normalizedError);
});

export default client;
