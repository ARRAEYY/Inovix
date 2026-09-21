/**
 * Socket.IO server singleton + helpers.
 *
 * Spec ref: §3 enforcement Layer 1 (events emitted only AFTER DB transaction
 * commits, never before); §6.2 realtime events invalidate TanStack Query
 * cache keys on the client; §11 risk matrix — Socket.IO long-polling
 * fallback is automatic when WebSockets are blocked (college exam week).
 *
 * Events emitted:
 *   - order:new                  → to outlet:outletId room
 *   - order:status:changed        → to outlet:outletId room AND student:userId room
 *   - notification:created       → to user:userId room
 *
 * Auth: client sends the access token in the `auth` field of io.connect().
 * The connection middleware verifies it and joins the appropriate rooms.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGIN = process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173';

let io = null;

function initSocketServer(httpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: { origin: CORS_ORIGIN.split(','), credentials: true },
    // Long-polling fallback is on by default. The transports array
    // orders preferred → fallback. College networks that block ws://
    // will silently downgrade to polling.
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Auth middleware — verify access token, join rooms
  io.use(async (socket, next) => {
    try {
      const { token } = socket.handshake.auth || {};
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: { outletStaff: true },
      });

      if (!user) return next(new Error('User not found'));
      if (user.status === 'SUSPENDED') return next(new Error('Account suspended'));

      socket.data.userId = user.id;
      socket.data.role = user.role;
      socket.data.outletId = user.outletStaff?.outletId || null;

      // Join rooms
      socket.join(`user:${user.id}`);
      if (user.outletStaff?.outletId) {
        socket.join(`outlet:${user.outletStaff.outletId}`);
      }
      if (user.role === 'SUPER_ADMIN') socket.join('super-admin');

      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket.io] connected: user=${socket.data.userId} role=${socket.data.role} outlet=${socket.data.outletId || '-'}`);

    socket.on('disconnect', () => {
      console.log(`[socket.io] disconnected: user=${socket.data.userId}`);
    });
  });

  return io;
}

/**
 * Emit an order event to a room. Safe to call when io is null (e.g. in tests)
 * — the event is just dropped silently.
 */
function emitOrderEvent(event, roomId, payload) {
  if (!io) return;
  io.to(roomId).emit(event, payload);
}

/**
 * Emit a notification event to a single user.
 */
function emitNotificationEvent(userId, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification:created', payload);
}

function getIo() { return io; }

module.exports = { initSocketServer, emitOrderEvent, emitNotificationEvent, getIo };
