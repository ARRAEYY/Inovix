/**
 * Socket.IO singleton for the Nosh backend on port 3001.
 *
 * Connection contract (per project rules):
 *   - Path: '/'  (so Caddy can forward via the XTransformPort query)
 *   - Query: `XTransformPort=3001`
 *   - Auth: `{ token: <accessToken> }` — the backend socket middleware
 *     verifies the JWT and joins the user into user:/outlet:/super-admin
 *     rooms.
 *
 * The socket lazily connects when `connectSocket(token)` is first called
 * with a valid token. If the token refreshes (in-memory access token
 * rotates every 15 min), call `connectSocket(newToken)` again — it'll
 * tear down the old socket and reconnect with the fresh token.
 */

'use client';

import { io, type Socket } from 'socket.io-client';
import type { Order } from './types';

type OrderEventListener = (order: Order) => void;
type NotificationEventListener = (notification: {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead?: boolean;
  orderId?: string | null;
  createdAt?: string;
}) => void;
type ConnectionListener = (connected: boolean) => void;

let socket: Socket | null = null;

const orderListeners = new Set<OrderEventListener>();
const statusListeners = new Set<OrderEventListener>();
const notificationListeners = new Set<NotificationEventListener>();
const connectionListeners = new Set<ConnectionListener>();

function attachListeners(s: Socket) {
  s.on('connect', () => {
    for (const l of connectionListeners) l(true);
  });
  s.on('disconnect', () => {
    for (const l of connectionListeners) l(false);
  });
  s.on('connect_error', () => {
    for (const l of connectionListeners) l(false);
  });
  s.on('order:new', (payload: { order: Order } | Order) => {
    const order = (payload as { order?: Order }).order ?? (payload as Order);
    for (const l of orderListeners) l(order);
  });
  s.on('order:status:changed', (payload: { order: Order } | Order) => {
    const order = (payload as { order?: Order }).order ?? (payload as Order);
    for (const l of statusListeners) l(order);
  });
  s.on('notification:created', (n: Parameters<NotificationEventListener>[0]) => {
    for (const l of notificationListeners) l(n);
  });
}

/**
 * Establish (or re-establish) the socket connection with the current token.
 * Safe to call repeatedly — passing the same token is a no-op, passing a
 * new token disconnects + reconnects.
 */
export function connectSocket(token: string | null): Socket | null {
  if (!token) {
    disconnectSocket();
    return null;
  }
  if (socket && socket.auth && (socket.auth as { token?: string }).token === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  // Different token (or first connect) — tear down + reconnect.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  socket = io('/?XTransformPort=3001', {
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 10000,
  });
  attachListeners(socket);
  socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  for (const l of connectionListeners) l(false);
}

export function onOrderNew(l: OrderEventListener): () => void {
  orderListeners.add(l);
  return () => orderListeners.delete(l);
}
export function onOrderStatusChanged(l: OrderEventListener): () => void {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}
export function onNotificationCreated(l: NotificationEventListener): () => void {
  notificationListeners.add(l);
  return () => notificationListeners.delete(l);
}
export function onConnectionChange(l: ConnectionListener): () => void {
  connectionListeners.add(l);
  if (socket) l(socket.connected);
  return () => connectionListeners.delete(l);
}
