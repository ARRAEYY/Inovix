const express = require('express');
const {
  googleLogin,
  devLogin,
  getCurrentUser,
  refresh,
  logout,
} = require('./auth.controller');
const { protect } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validation.middleware');
const { googleLoginSchema, devLoginSchema } = require('@nosh/validation');
const { z } = require('zod');

const router = express.Router();

// Public routes
router.post('/google', validateBody(googleLoginSchema), googleLogin);
router.post('/refresh', validateBody(z.object({ refreshToken: z.string() }).strict()), refresh);

// Dev-only route (gated in controller + .env NODE_ENV)
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', validateBody(devLoginSchema), devLogin);
}

// Authenticated routes
router.get('/me', protect, getCurrentUser);
router.post('/logout', protect, logout);

module.exports = router;
