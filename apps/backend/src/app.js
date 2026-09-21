const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./modules/auth/auth.routes');
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const outletOrdersRoutes = require('./modules/orders/outlet-orders.routes');
const outletMenuRoutes = require('./modules/menu/menu.routes');
const catalogRoutes = require('./modules/catalog/catalog.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const uploadsRoutes = require('./modules/uploads/uploads.routes');

const { errorHandler } = require('./middleware/error.middleware');
const { authRateLimit, apiRateLimit } = require('./middleware/rateLimit.middleware');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// INO-011 fix: in production, accept ONLY the configured FRONTEND_URL. The
// previous implementation unconditionally appended `http://localhost:5173`
// and `http://localhost:3001` to the origin list — a staging/preview/prod
// deploy kept localhost origins live, expanding the browser-trusted surface
// for any attacker who can run code on localhost. Localhost origins are
// accepted only when NODE_ENV !== 'production' so dev workflows keep working.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production';

function safeDecode(val) {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index === -1) return [part.trim(), ''];
    return [part.slice(0, index).trim(), safeDecode(part.slice(index + 1).trim())];
  }));
}

app.use((req, _res, next) => {
  req.cookies = parseCookies(req);
  next();
});
const corsOrigins = isProduction
  ? [FRONTEND_URL]
  : Array.from(new Set([FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3001']));
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Campus Food API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ── API Rate Limiting ─────────────────────────────────────────────────────────
// Apply before any route mounts so every /api/v1/* request is throttled.
app.use('/api/v1/', apiRateLimit);

// ── Routes — payments FIRST (raw-body webhook) ───────────────────────────────
// INO-P0-1 fix: the Razorpay webhook route needs the *raw* request body to
// verify the X-Razorpay-Signature HMAC. The previous ordering mounted the
// global `express.json()` parser BEFORE the payments router, which meant
// `req.body` was already a parsed object by the time the webhook's
// `express.raw()` middleware ran — so `req.body.toString('utf8')` in the
// webhook controller produced `"[object Object]"` and signature verification
// always failed.
//
// Fix: mount the payments router (which carries the webhook route with its
// own `express.raw()` middleware) BEFORE the global JSON parser. Other
// routes mounted on the same router (e.g. /razorpay/order, /razorpay/verify)
// fall through to the global JSON parser as normal — they don't need the raw
// body. The webhook route itself short-circuits with `express.raw()`.
app.use('/api/v1/payments', paymentsRoutes);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRateLimit, authRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/outlet/orders', outletOrdersRoutes);
app.use('/api/v1/outlet/menu', outletMenuRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/uploads', uploadsRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    errors: [],
  });
});

// ── Centralized Error Handler (must be last) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
