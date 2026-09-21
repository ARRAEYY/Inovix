const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const {
  razorpayOrderCreateSchema,
  razorpayPaymentVerifySchema,
  razorpayCredentialsSchema,
} = require('@nosh/validation');
const paymentsController = require('./payments.controller');
const paymentsService = require('./payments.service');
const { audit } = require('../../lib/audit');

const router = express.Router();

// Authenticated routes
router.post('/razorpay/order', protect, validateBody(razorpayOrderCreateSchema), paymentsController.createRazorpayOrder);
router.post('/razorpay/verify', protect, validateBody(razorpayPaymentVerifySchema), paymentsController.verifyPayment);

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
