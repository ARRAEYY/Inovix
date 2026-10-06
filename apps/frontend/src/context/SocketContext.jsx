import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import client from '../services/api/client';

// Socket.IO client — connects to the Inovix backend on Render.
// Listens for:
//   - order:status:changed → outlet staff get live order updates
//   - notification:created → students get push notifications
// The socket authenticates with the access token (passed via the `auth`
// field). The backend's socket middleware verifies the JWT + joins the
// user to their role-based rooms (user:<id>, outlet:<outletId>, etc.)
const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  // One refresh-and-retry per connection sequence: the access token lives
  // 15 minutes, so an idle tab's next socket reconnect fails with
  // "Authentication failed". The httpOnly refresh cookie is still valid —
  // mint a fresh access token and reconnect instead of staying dead until
  // a full page reload. Reset on every successful connect.
  const reauthRef = useRef(false);

  useEffect(() => {
    if (!token || !user) {
      // Not authenticated — disconnect any existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Connect to the backend's Socket.IO server
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    // Derive the base URL (strip /api/v1 from the end)
    const baseUrl = apiUrl.replace(/\/api\/v\/?\d*\/?$/, '');
    const socketUrl = baseUrl || window.location.origin;

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      reauthRef.current = false;
      console.log('[socket] connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    socket.on('connect_error', async (err) => {
      console.warn('[socket] connect error:', err.message);
      const authFailed = /authentication/i.test(err?.message || '');
      if (!authFailed || reauthRef.current) return;
      reauthRef.current = true;
      try {
        const res = await client.post('/auth/refresh');
        const newToken = res.data?.data?.accessToken;
        if (!newToken) return;
        localStorage.setItem('accessToken', newToken);
        socket.auth.token = newToken;
        socket.connect();
      } catch {
        // Refresh failed — the session is genuinely over; the axios
        // interceptor bounces to login on the next API call.
        console.warn('[socket] re-auth failed — session expired');
      }
    });

    // When a new order is placed, dispatch window events so outlet boards and admin dashboards refetch.
    socket.on('order:new', (data) => {
      console.log('[socket] order:new:', data);
      window.dispatchEvent(new CustomEvent('nosh:order-new', { detail: data }));
      window.dispatchEvent(new CustomEvent('nosh:order-updated', { detail: data }));
    });

    // When an order's status changes (outlet accepts/prepares/marks ready),
    // dispatch a window event so the student Orders page can refetch.
    socket.on('order:status:changed', (data) => {
      console.log('[socket] order:status:changed:', data);
      window.dispatchEvent(new CustomEvent('nosh:order-updated', { detail: data }));
    });

    // When a notification is created (order accepted, ready, etc.),
    // dispatch a window event so the notification bell can refetch.
    socket.on('notification:created', (data) => {
      console.log('[socket] notification:created:', data);
      window.dispatchEvent(new CustomEvent('nosh:notification', { detail: data }));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
