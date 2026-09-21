import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth/authService';
import { setOnAuthFailed, clearTokens } from '../services/api/client';

export const AuthContext = createContext(null);

// INO-P1-22 fix: minimize what we persist to localStorage. The API's
// stripSensitive() only removes passwordHash + googleId, but the user
// object can also contain profile data such as phone, college ID, course,
// year — sensitive-ish student data that shouldn't sit in persistent
// browser storage. Persist ONLY the minimum UI identity needed to render
// the app shell before the next /auth/refresh roundtrip completes; any
// profile data should be fetched on demand from /api/v1/users/me (or a
// future profile endpoint) when the user visits the profile page.
const STORAGE_KEY = 'user';
function minifyUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    // outletId + outletRole are single values the UI needs to render
    // the outlet dashboard vs student view; not really sensitive.
    outletId: user.outletId || null,
    outletRole: user.outletRole || null,
    // onboardingCompleted is a single boolean — the router needs it to
    // decide whether to redirect to /onboarding. Not sensitive.
    onboardingCompleted: !!user.onboardingCompleted,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, use the HttpOnly refresh cookie to obtain a short-lived access token.
  // The refresh token is never exposed to browser JavaScript.
  useEffect(() => {
    let mounted = true;
    const storedUser = localStorage.getItem(STORAGE_KEY);

    // Optimistically set the cached user so UI doesn't flash
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch {}
    }

    setOnAuthFailed(() => {
      setUser(null);
      clearTokens();
    });

    authService.refresh()
      .then(({ user: freshUser }) => {
        if (mounted) {
          // Persist ONLY the minified identity (INO-P1-22). The full user
          // object (with any profile data) stays in React state for this
          // session but is NOT written to localStorage.
          setUser(freshUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(minifyUser(freshUser)));
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
    // clearTokens() in client.js already removes the localStorage entry,
    // but be explicit — the storage key is owned by AuthContext now.
    localStorage.removeItem(STORAGE_KEY);
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
