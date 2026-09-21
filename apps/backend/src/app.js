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
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}));

// ── Body Parsing ──────────────────────────────────────────────────────────────
// The Razorpay webhook route overrides this with express.raw() — see
// payments.routes.js. The JSON parser here is for everything else.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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
app.use('/api/v1/', apiRateLimit);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRateLimit, authRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/outlet/orders', outletOrdersRoutes);
app.use('/api/v1/outlet/menu', outletMenuRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/uploads', uploadsRoutes);
// Webhook mounted at root for cleaner URL (Razorpay config):
//   POST /api/v1/payments/razorpay/webhook (see payments.routes.js)

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
