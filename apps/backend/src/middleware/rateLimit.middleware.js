const rateLimit = require('express-rate-limit');

/**
 * INO-010 fix: per-endpoint auth rate limiters.
 *
 * The previous implementation applied a single broad limiter
 * (20 requests / 15 min / IP) to every auth route. The security spec
 * calls for:
 *   - login (Google OAuth)            → 5 req/min/IP
 *   - password-style endpoints       → 10 req/min/IP
 *   - refresh                         → moderate (legitimate clients
 *                                       refresh every ~15min, multiple
 *                                       devices per user)
 *   - other authenticated endpoints  → generous (already authed)
 *
 * Each limiter is skipped in NODE_ENV=test so the test suite isn't throttled.
 */

const isTest = () => process.env.NODE_ENV === 'test';

const baseMessage = {
  success: false,
  code: 'RATE_LIMIT_EXCEEDED',
  errors: [],
};

// Google OAuth login — strictest.
const googleLoginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...baseMessage,
    message: 'Too many login attempts. Try again in a minute.',
  },
  skip: isTest,
});

// Dev login — password-style bypass. Same window as the spec's password-reset
// policy (10/min/IP). Only mounted in development + opt-in (see auth.routes.js).
const devLoginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...baseMessage,
    message: 'Too many dev-login attempts. Try again in a minute.',
  },
  skip: isTest,
});

// Refresh — rotating tokens. Legitimate clients refresh roughly every 15min,
// and a single user may have multiple devices. 30/15min is generous for
// legit traffic but still throttles token-theft attempts.
const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...baseMessage,
    message: 'Too many refresh attempts. Try again later.',
  },
  skip: isTest,
});

// Other authenticated auth endpoints (/me, /logout) — low risk, generous.
const authEndpointsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...baseMessage,
    message: 'Too many requests, please slow down.',
  },
  skip: isTest,
});

// Backward-compat alias: existing code applies `authRateLimit` to the whole
// auth router as a catch-all. Keep it as the most permissive limiter so
// routes that aren't explicitly wrapped still get some protection.
const authRateLimit = authEndpointsRateLimit;

/**
 * General API rate limiter.
 */
const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ...baseMessage,
    message: 'Too many requests, please slow down.',
  },
  skip: isTest,
});

module.exports = {
  googleLoginRateLimit,
  devLoginRateLimit,
  refreshRateLimit,
  authEndpointsRateLimit,
  // Backward-compat:
  authRateLimit,
  apiRateLimit,
};
