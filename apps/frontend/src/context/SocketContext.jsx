import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

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
      console.log('[socket] connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect error:', err.message);
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
