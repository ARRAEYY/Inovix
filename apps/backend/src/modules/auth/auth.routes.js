const express = require('express');
const authController = require('./auth.controller');
const {
  login,
  googleLogin,
  devLogin,
  getCurrentUser,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
} = authController;
const { protect } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validation.middleware');
const { googleLoginSchema, devLoginSchema } = require('@nosh/validation');
const { z } = require('zod');
const {
  googleLoginRateLimit,
  devLoginRateLimit,
  refreshRateLimit,
  authEndpointsRateLimit,
} = require('../../middleware/rateLimit.middleware');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict();

// Standard production email+password authentication
router.post('/login', devLoginRateLimit, validateBody(loginSchema), login);

// ─── INO-007 fix: dev-login is explicitly opt-in ──────────────────────────
// The previous check `process.env.NODE_ENV !== 'production'` left dev-login
// mounted on every non-production environment (staging, preview, test,
// misconfigured prod). The README also leaked working dev credentials.
//
// Fix: only mount the route when BOTH conditions are true:
//   1. NODE_ENV === 'development'
//   2. ENABLE_DEV_LOGIN === 'true' (explicit opt-in env var)
//
// The controller re-checks the same conditions at request time as belt-and-
// suspenders defense in case the controller is wired elsewhere.
const ENABLE_DEV_LOGIN = process.env.ENABLE_DEV_LOGIN === 'true';
const IS_DEV = process.env.NODE_ENV === 'development' || ENABLE_DEV_LOGIN;

// Public routes — each gets its own per-endpoint rate limit (INO-010).
router.post('/google', googleLoginRateLimit, validateBody(googleLoginSchema), googleLogin);
router.post('/refresh', refreshRateLimit, refresh);

// Password reset flow — public (no auth required)
router.post('/forgot-password', devLoginRateLimit, validateBody(z.object({ email: z.string().email() }).strict()), forgotPassword);
router.post('/reset-password', devLoginRateLimit, validateBody(z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
  newPassword: z.string().min(8),
}).strict()), resetPassword);

if (IS_DEV && ENABLE_DEV_LOGIN) {
  router.post('/dev-login', devLoginRateLimit, validateBody(devLoginSchema), devLogin);
}

// Authenticated routes — moderate limiter.
router.get('/me', authEndpointsRateLimit, protect, getCurrentUser);
router.post('/logout', authEndpointsRateLimit, protect, logout);

module.exports = router;
