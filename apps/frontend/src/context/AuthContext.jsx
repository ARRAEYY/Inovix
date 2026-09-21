import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth/authService';
import { setOnAuthFailed, clearTokens } from '../services/api/client';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token exists in localStorage, fetch /me to verify it.
  // The API client auto-refreshes on 401, so this works even if the access
  // token is expired but the refresh token is still valid.
  useEffect(() => {
    let mounted = true;
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Optimistically set the cached user so UI doesn't flash
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch {}
    }

    setOnAuthFailed(() => {
      setUser(null);
      clearTokens();
    });

    authService.me()
      .then((freshUser) => {
        if (mounted) {
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser));
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          clearTokens();
        }
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: freshUser } = await authService.devLogin(email, password);
    setUser(freshUser);
    return freshUser;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const { user: freshUser } = await authService.googleLogin(credential);
    setUser(freshUser);
    return freshUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const value = {
    user,
    login,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
