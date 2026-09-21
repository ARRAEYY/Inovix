/**
 * Socket.IO client singleton.
 *
 * Spec ref: §6.2 — realtime events invalidate TanStack Query cache keys.
 *
 * Auth: pass the access token via the `auth` field. The server verifies +
 * joins the user to rooms (`user:<id>`, `outlet:<outletId>`, `super-admin`).
 *
 * Reconnect: built-in to socket.io-client (exponential backoff). On reconnect,
 * the auth middleware re-runs so the rooms are re-joined automatically.
 *
 * Long-polling fallback: enabled via `transports: ['websocket', 'polling']`.
 */

import { io } from 'socket.io-client';
import { getAccessToken } from '../api/client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket = null;
let queryClientRef = null; // set by useRealtime() hook

export function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
  });

  socket.on('connect', () => {
    console.log('[socket.io] connected');
  });
  socket.on('disconnect', (reason) => {
    console.log('[socket.io] disconnected:', reason);
  });
  socket.on('connect_error', (err) => {
    console.warn('[socket.io] connect error:', err.message);
  });

  // Register invalidation handlers (only fires if queryClient is set)
  socket.on('order:new', () => {
    queryClientRef?.invalidateQueries({ queryKey: ['orders', 'outlet', 'list'] });
  });
  socket.on('order:status:changed', (payload) => {
    queryClientRef?.invalidateQueries({ queryKey: ['orders', 'outlet', 'list'] });
    queryClientRef?.invalidateQueries({ queryKey: ['orders', 'student', 'list'] });
    queryClientRef?.invalidateQueries({ queryKey: ['orders', 'detail', payload?.order?.id] });
  });
  socket.on('notification:created', () => {
    queryClientRef?.invalidateQueries({ queryKey: ['notifications', 'list'] });
  });

  return socket;
}

export function setQueryClientForRealtime(qc) {
  queryClientRef = qc;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Allow re-auth after a token refresh (socket stays connected but auth
// middleware has cached the old token). Reconnecting re-runs auth.
export function reauthSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    getSocket();
  }
}
