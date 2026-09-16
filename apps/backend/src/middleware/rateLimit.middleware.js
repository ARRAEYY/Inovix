const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints.
 * Prevents brute-force attacks on login and token endpoints.
 */
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,                   // max 20 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
        errors: [],
    },
    skip: () => process.env.NODE_ENV === 'test',
});

/**
 * General API rate limiter.
 */
const apiRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please slow down.',
        code: 'RATE_LIMIT_EXCEEDED',
        errors: [],
    },
    skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { authRateLimit, apiRateLimit };
