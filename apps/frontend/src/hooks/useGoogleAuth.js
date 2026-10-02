import { useCallback } from 'react';
import client from '../services/api/client';

// useGoogleAuth — wires the "Continue with Google" buttons to the OAuth
// authorization-code REDIRECT flow (more reliable than the GIS popup,
// which fails on popup blockers, headless browsers, and FedCM issues).
//
// Flow:
//   1. signInWithGoogle() → window.location.href = '/api/v1/auth/google'
//   2. Backend GET /auth/google: builds the Google consent URL with
//      redirect_uri=<origin>/api/v1/auth/google/callback (origin derived
//      from X-Forwarded-Host set by the Next.js reverse-proxy), sets a
//      google_oauth_state httpOnly cookie (CSRF), 302-redirects to Google.
//   3. User picks an account on Google.
//   4. Google 302-redirects to <origin>/api/v1/auth/google/callback?code=...&state=...
//   5. Backend GET /auth/google/callback: verifies the state cookie,
//      exchanges the code for tokens (uses GOOGLE_CLIENT_SECRET), finds
//      or creates the user, sets the nosh_refresh httpOnly cookie,
//      302-redirects to /inovix-app/?google_login=success
//   6. The Inovix app loads — AuthContext detects ?google_login=success,
//      calls /auth/refresh (the proxy forwards the httpOnly cookie),
//      gets a fresh access token, calls /auth/me, stores the user,
//      navigates to the dashboard by role. See AuthContext.jsx.
//
// The GIS popup flow is kept as a fallback (signInWithGooglePopup) for
// environments where the redirect_uri isn't registered.

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let gsiLoaderPromise = null;

function loadGsi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoaderPromise) return gsiLoaderPromise;
  gsiLoaderPromise = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    if (window.google?.accounts?.id) return resolve();
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(timer);
      if (!window.google?.accounts?.id) {
        reject(new Error('Google Identity Services failed to load'));
      }
    }, 10000);
  });
  return gsiLoaderPromise;
}

export function useGoogleAuth({ onSuccess, onError } = {}) {
  // ─── Redirect flow (primary) ───────────────────────────────────────────
  // Just navigate to the backend's GET /auth/google. The backend builds
  // the Google OAuth URL, sets the state cookie, and 302s to Google. The
  // rest is handled by the callback + AuthContext (see AuthContext.jsx).
  const signInWithGoogle = useCallback(() => {
    // Use the FULL VITE_API_URL so this works in BOTH deployments:
    //   - Next.js reverse-proxy (VITE_API_URL=/api/v1 → same-origin, proxied)
    //   - Vercel standalone (VITE_API_URL=https://<backend>.onrender.com/api/v1 → cross-origin)
    // A relative '/api/v1/auth/google' would break on Vercel (the frontend
    // domain has no /api/v1 route).
    const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
    window.location.href = `${apiBase}/auth/google`;
  }, []);

  // ─── Popup flow (fallback) ─────────────────────────────────────────────
  // Used when the redirect_uri isn't registered (e.g. a fresh preview
  // session). The GIS library returns an ID token directly to JS; we POST
  // it to /auth/google (POST — the popup endpoint). Less reliable than the
  // redirect flow (popup blockers, FedCM failures) but doesn't need a
  // registered redirect_uri — only an Authorized JavaScript origin.
  const signInWithGooglePopup = useCallback(async () => {
    if (!CLIENT_ID) {
      onError?.(new Error('VITE_GOOGLE_CLIENT_ID is not set'));
      return;
    }
    try {
      await loadGsi();
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response) => {
          const credential = response?.credential;
          if (!credential) {
            onError?.(new Error('No Google credential returned'));
            return;
          }
          try {
            const res = await client.post('/auth/google', { credential });
            const data = res.data?.data || {};
            if (res.data?.success && data.accessToken && data.user) {
              localStorage.setItem('accessToken', data.accessToken);
              localStorage.setItem('user', JSON.stringify(data.user));
              onSuccess?.(data.user);
            } else {
              onError?.(new Error(res.data?.message || 'Google login failed'));
            }
          } catch (err) {
            onError?.(err.response?.data || err);
          }
        },
      });
      window.google.accounts.id.prompt();
    } catch (err) {
      onError?.(err);
    }
  }, [onSuccess, onError]);

  return {
    // Primary — use this on the "Continue with Google" buttons.
    signInWithGoogle,
    // Fallback — only when you know the redirect_uri isn't registered.
    signInWithGooglePopup,
    clientId: CLIENT_ID,
  };
}
