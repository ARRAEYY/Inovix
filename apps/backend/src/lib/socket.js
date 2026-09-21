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
const { USER_STATUS, ROLES, ERROR_CODES } = require('./constants');

const JWT_SECRET = process.env.JWT_SECRET;
const CORS_ORIGIN = process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173';

let io = null;

function initSocketServer(httpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    // INO-011 (mirror): in production, operators must set SOCKET_IO_CORS_ORIGIN
    // to the production frontend URL. localhost is a dev default only.
    cors: { origin: CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean), credentials: true },
    // Long-polling fallback is on by default. The transports array
    // orders preferred → fallback. College networks that block ws://
    // will silently downgrade to polling.
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // ─── INO-012 fix: harden socket auth ─────────────────────────────────────
  // The previous middleware mirrored `protect` only loosely — it checked
  // `user.status === 'SUSPENDED'` but didn't reject PENDING users (who
  // haven't completed onboarding and shouldn't be receiving realtime
  // events), and didn't catch JWT/DB role drift (e.g. a user whose role
  // was changed by a super-admin after the access token was issued).
  //
  // The audit explicitly classified this as hardening, not a confirmed
  // vuln: server-side emission only, no obvious client-to-server order-
  // manipulation event. The fixes below are conservative:
  //   1. Reject both SUSPENDED and PENDING users with a clear reason.
  //   2. Reject if decoded.role exists and doesn't match the live DB role.
  //   3. Use ERROR_CODES for consistency with the HTTP protect middleware.
  //
  // This file does NOT emit any client-to-server events. If that ever
  // changes, every incoming event MUST be authorized via the same RBAC
  // matrix used by the HTTP protect/authorizeRole/requireOutletScope chain.
  io.use(async (socket, next) => {
    try {
      const { token } = socket.handshake.auth || {};
      if (!token) {
        const err = new Error('Authentication required');
        err.code = ERROR_CODES.UNAUTHORIZED;
        return next(err);
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: { outletStaff: true },
      });

      if (!user) {
        const err = new Error('User not found');
        err.code = ERROR_CODES.UNAUTHORIZED;
        return next(err);
      }

      if (user.status === USER_STATUS.SUSPENDED) {
        const err = new Error('Account suspended');
        err.code = ERROR_CODES.ACCOUNT_SUSPENDED;
        return next(err);
      }
      if (user.status === USER_STATUS.PENDING) {
        // PENDING users haven't completed onboarding — they shouldn't be
        // joining realtime rooms yet.
        const err = new Error('Account pending — complete onboarding first');
        err.code = ERROR_CODES.ACCOUNT_SUSPENDED;
        return next(err);
      }

      // Defense-in-depth: if the JWT-embedded role exists and disagrees with
      // the live DB role, the token is stale — reject and force re-auth.
      if (decoded.role && decoded.role !== user.role) {
        const err = new Error('Authentication failed');
        err.code = ERROR_CODES.UNAUTHORIZED;
        return next(err);
      }

      socket.data.userId = user.id;
      socket.data.role = user.role;
      socket.data.outletId = user.outletStaff?.outletId || null;

      // Join rooms
      socket.join(`user:${user.id}`);
      if (user.outletStaff?.outletId) {
        socket.join(`outlet:${user.outletStaff.outletId}`);
      }
      if (user.role === ROLES.SUPER_ADMIN) socket.join('super-admin');

      next();
    } catch (err) {
      const error = new Error('Authentication failed');
      error.code = ERROR_CODES.UNAUTHORIZED;
      next(error);
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
