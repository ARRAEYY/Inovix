/**
 * Auth UI state — single source of truth for the access token, current
 * user, role, and login/logout/refresh side-effects.
 *
 * Access token is held in memory ONLY (never localStorage). The
 * httpOnly `nosh_refresh` cookie is the long-lived credential and is
 * managed entirely by the backend; the browser sends it automatically
 * on `credentials: 'include'` requests.
 *
 * The API client (./api) reads the token via `useAuthStore.getState().accessToken`
 * and updates it via `setAccessToken`. This avoids circular imports.
 */

'use client';

import { create } from 'zustand';
import type { Role, User } from './types';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  role: Role | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  /** Set once the initial refresh attempt has resolved (success or fail). */
  initialised: boolean;

  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  setStatus: (status: AuthState['status']) => void;
  setInitialised: (v: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  role: null,
  status: 'idle',
  initialised: false,

  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      role: user.role,
      status: 'authenticated',
      initialised: true,
    }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setUser: (user) => set({ user, role: user.role }),

  setStatus: (status) => set({ status }),

  setInitialised: (initialised) => set({ initialised }),

  clear: () =>
    set({
      user: null,
      accessToken: null,
      role: null,
      status: 'unauthenticated',
      initialised: true,
    }),
}));

/** Convenience selector — is the current user an outlet-side role? */
export function isOutletRole(role: Role | null | undefined): boolean {
  return role === 'OUTLET_STAFF' || role === 'OUTLET_ADMIN';
}
