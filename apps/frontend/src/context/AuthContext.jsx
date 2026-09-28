import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/auth/authService';
import client from '../services/api/client';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from local storage on load
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
      }
      setLoading(false);
      return;
    }

    // ─── Google OAuth redirect-flow callback ────────────────────────────
    // When the backend's GET /auth/google/callback finishes, it sets the
    // nosh_refresh httpOnly cookie and 302-redirects to
    // /inovix-app/?google_login=success. We land here with no localStorage
    // (the user just logged in via Google, no email+password flow ran),
    // but the refresh cookie IS present (same-origin via the Next.js
    // reverse-proxy). Call /auth/refresh to mint a fresh access token,
    // then /auth/me to fetch the user, store both, and let the
    // role-aware PrivateRoute / login-page navigation handle the rest.
    //
    // On error (?google_login=error&reason=...), leave the user on the
    // login page — the login pages read the same URL params and surface
    // the error message via their own useEffect.
    const params = new URLSearchParams(window.location.search);
    const googleLogin = params.get('google_login');

    if (googleLogin === 'success') {
      // Clean the URL first so a refresh doesn't re-trigger this.
      window.history.replaceState({}, '', window.location.pathname);
      (async () => {
        try {
          // The refresh cookie is httpOnly + path=/api/v1/auth. The
          // axios client has withCredentials=true, so the browser sends
          // it on this same-origin request through the Next.js proxy.
          const refreshRes = await client.post('/auth/refresh', {});
          const accessToken = refreshRes.data?.data?.accessToken;
          if (!accessToken) {
            setLoading(false);
            return;
          }
          // Set the token on the axios client immediately so the
          // /auth/me call below is authenticated.
          localStorage.setItem('accessToken', accessToken);
          client.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          setToken(accessToken);
          // Fetch the user.
          const meRes = await client.get('/auth/me');
          const meUser = meRes.data?.data?.user;
          if (meUser) {
            localStorage.setItem('user', JSON.stringify(meUser));
            setUser(meUser);
          }
        } catch (e) {
          // Refresh failed — the cookie may not have been set (e.g.
          // third-party cookie blocking) or the session expired. Leave
          // the user on the login page; the PrivateRoute will redirect
          // to `/` which renders StudentLogin.
          console.error('Google login refresh failed:', e);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    // Clean any other google_login param (e.g. 'error') from the URL so
    // it doesn't loop — the login pages read it before this runs, but
    // a stale param on a protected route would cause issues.
    if (googleLogin === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
    }

    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await authService.login(email, password);
    if (response.success && response.data) {
      const { user, accessToken } = response.data;
      setUser(user);
      setToken(accessToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    }
    return null;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    authService.logout();
  };

  const updateProfile = async (data) => {
    const response = await authService.updateProfile(data);
    if (response.success && response.data) {
      const updatedUser = response.data.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    }
    return null;
  };

  const value = {
    user,
    token,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
