const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const {
  razorpayOrderCreateSchema,
  razorpayPaymentVerifySchema,
  razorpayCredentialsSchema,
  devPaymentConfirmSchema,
} = require('@nosh/validation');
const paymentsController = require('./payments.controller');
const paymentsService = require('./payments.service');
const { audit } = require('../../lib/audit');

const router = express.Router();

// The payments router is mounted in app.js BEFORE the global express.json()
// (so the webhook route gets the raw body for HMAC signature verification).
// But that means the NON-webhook routes (e.g. /razorpay/order, /razorpay/verify,
// /admin/outlets/:id/razorpay-credentials) also miss JSON parsing → req.body
// is undefined → validation fails with "expected object, received undefined".
//
// Fix: apply express.json() to all routes EXCEPT the webhook. The webhook
// route below has its own express.raw() route-level middleware.
router.use((req, res, next) => {
  if (req.path === '/razorpay/webhook') return next();
  return express.json({ limit: '10kb' })(req, res, next);
});

// Authenticated routes
router.post('/razorpay/order', protect, validateBody(razorpayOrderCreateSchema), paymentsController.createRazorpayOrder);
router.post('/razorpay/verify', protect, validateBody(razorpayPaymentVerifySchema), paymentsController.verifyPayment);

// ─── Dev-only mock payment confirm ──────────────────────────────────────
// Mounted ONLY when NODE_ENV=development AND ENABLE_DEV_LOGIN=true — the
// same explicit opt-in gate as /auth/dev-login. Lets local dev run the full
// prepaid order lifecycle (order → payment PAID → outlet transitions) with
// no Razorpay credentials configured. In production the route doesn't exist.
const DEV_PAYMENT_ENABLED =
  process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_LOGIN === 'true';
if (DEV_PAYMENT_ENABLED) {
  router.post(
    '/dev-confirm',
    protect,
    validateBody(devPaymentConfirmSchema),
    paymentsController.devConfirmPayment
  );
}

// Razorpay webhook — public (verified via signature, NOT JWT)
// MUST use express.raw because the signature is computed over the raw body.
// Body parsing for this route is special-cased in app.js.
router.post('/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentsController.webhook);

// Super-admin: set per-outlet Razorpay credentials
router.post(
  '/admin/outlets/:outletId/razorpay-credentials',
  protect,
  authorizeRole(ROLES.SUPER_ADMIN),
  validateBody(razorpayCredentialsSchema),
  async (req, res, next) => {
    try {
      await paymentsService.setOutletRazorpayCredentials(req.params.outletId, req.body);
      await audit({
        actorId: req.user.id,
        action: 'RAZORPAY_CREDENTIALS_SET',
        targetType: 'Outlet',
        targetId: req.params.outletId,
        req,
      });
      res.status(200).json({ success: true, message: 'Razorpay credentials stored (encrypted)' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
