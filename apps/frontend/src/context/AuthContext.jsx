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
    // The backend's GET /auth/google/callback finishes by 302-redirecting to
    // https://inovix-iota.vercel.app/?google_login=success#at=<accessToken>
    //
    // We land here with no localStorage (the user just signed in via Google).
    // Two ways to recover the session:
    //   1. PREFERRED — read the access token from the URL hash fragment
    //      (#at=<jwt>). Hash fragments aren't sent to servers (no referrer
    //      leak), and this works even when third-party cookies are blocked
    //      (Safari ITP, Chrome's phase-out) — the backend set the
    //      nosh_refresh httpOnly cookie but cross-site cookies may not be
    //      sent on the /auth/refresh fetch.
    //   2. FALLBACK — if no hash token, call /auth/refresh and rely on the
    //      httpOnly cookie (works only if third-party cookies are allowed).
    //
    // On error (?google_login=error&reason=...), leave the user on the
    // login page — the login pages read the same URL params and surface
    // the error message via their own useEffect.
    const params = new URLSearchParams(window.location.search);
    const googleLogin = params.get('google_login');
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hashToken = hashParams.get('at');

    if (googleLogin === 'success' && hashToken) {
      // PREFERRED path — token in hash. Clean the URL first (removes the
      // token from the address bar + history), then fetch the user + navigate.
      window.history.replaceState({}, '', window.location.pathname);
      (async () => {
        try {
          localStorage.setItem('accessToken', hashToken);
          client.defaults.headers.common.Authorization = `Bearer ${hashToken}`;
          setToken(hashToken);
          // Fetch the user with the token we just got.
          const meRes = await client.get('/auth/me');
          const meUser = meRes.data?.data?.user;
          if (meUser) {
            localStorage.setItem('user', JSON.stringify(meUser));
            setUser(meUser);
            // ─── Navigate to the role-appropriate dashboard ────────────
            // Without this, the user lands on `/` (StudentLogin) even
            // though they're authenticated — the login page doesn't know
            // to navigate away. A full-page navigation (window.location)
            // is safe here: localStorage already has the token + user, so
            // the next load's PrivateRoute will let them through.
            const role = meUser.role;
            // Students who haven't completed onboarding → redirect to the
            // onboarding page (they need to fill in their profile).
            if (role === 'STUDENT' && !meUser.onboardingCompleted) {
              window.location.href = '/student/onboarding';
            } else if (role === 'SUPER_ADMIN') window.location.href = '/admin';
            else if (role === 'OUTLET_ADMIN') window.location.href = '/outlet/admin';
            else if (role === 'OUTLET_STAFF') window.location.href = '/outlet';
            else window.location.href = '/student';
            return;
          }
        } catch (e) {
          console.error('Google login: /auth/me failed:', e);
          // Token was bad — clean up so the user can re-login.
          localStorage.removeItem('accessToken');
          delete client.defaults.headers.common.Authorization;
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    if (googleLogin === 'success') {
      // FALLBACK path — no hash token, try the cookie-based refresh
      // (works only if third-party cookies are allowed by the browser).
      window.history.replaceState({}, '', window.location.pathname);
      (async () => {
        try {
          const refreshRes = await client.post('/auth/refresh', {});
          const accessToken = refreshRes.data?.data?.accessToken;
          if (!accessToken) {
            setLoading(false);
            return;
          }
          localStorage.setItem('accessToken', accessToken);
          client.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          setToken(accessToken);
          const meRes = await client.get('/auth/me');
          const meUser = meRes.data?.data?.user;
          if (meUser) {
            localStorage.setItem('user', JSON.stringify(meUser));
            setUser(meUser);
            // Navigate to the role-appropriate dashboard (same as above).
            const role = meUser.role;
            if (role === 'SUPER_ADMIN') window.location.href = '/admin';
            else if (role === 'OUTLET_ADMIN') window.location.href = '/outlet/admin';
            else if (role === 'OUTLET_STAFF') window.location.href = '/outlet';
            else window.location.href = '/student';
            return;
          }
        } catch (e) {
          // Refresh failed — third-party cookie was blocked. The user
          // needs to re-login (the access token wasn't passed in the hash
          // for some reason). Leave them on the login page.
          console.error('Google login: cookie refresh failed (third-party cookie blocked?):', e);
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

  // Listen for session-expired events from the axios client (when the
  // refresh-token rotation fails). Without this, the user stays on a
  // protected page seeing error toasts on every API call — React state
  // still says isAuthenticated: true. Clearing the state here lets the
  // PrivateRoute redirect to the login page immediately.
  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
      setToken(null);
      // The axios client already cleared localStorage; we just sync React.
    };
    window.addEventListener('nosh:session-expired', onSessionExpired);
    return () => window.removeEventListener('nosh:session-expired', onSessionExpired);
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
    const currentUser = user;
    setUser(null);
    setToken(null);
    authService.logout(currentUser);
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
