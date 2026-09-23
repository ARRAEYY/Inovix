/**
 * HTTP server entry — wraps the Express app in an http.Server so Socket.IO
 * can share the same port. Socket.IO is initialized here, not in app.js,
 * because app.js may be imported by tests that don't want a live socket
 * server running.
 */

// ─── Sentry (error monitoring) — MUST be first ──────────────────────────────
// In dev (no SENTRY_DSN), Sentry is a no-op — it just doesn't send events.
const Sentry = require('@sentry/node');

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  console.log(`[sentry] initialized (env: ${process.env.NODE_ENV || 'development'})`);
} else {
  console.log('[sentry] not configured (no SENTRY_DSN) — error monitoring disabled');
}

const http = require('http');
const app = require('./app');
const { initSocketServer } = require('./lib/socket');
const { initCron } = require('./lib/cron');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize Socket.IO on the same HTTP server
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO listening on the same port (transports: websocket, polling)`);
  // Initialize cron jobs (audit purge, refresh purge, pickup-timeout auto-complete)
  initCron();
});

// Graceful shutdown — stop the cron + close the HTTP server cleanly
function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down...`);
  try {
    const { stopCron } = require('./lib/cron');
    stopCron();
  } catch {}
  server.close(() => {
    console.log('[server] closed');
    process.exit(0);
  });
  // Hard exit if graceful close takes too long
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
