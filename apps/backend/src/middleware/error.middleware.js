const { ERROR_CODES } = require('../lib/constants');

/**
 * Centralized error handler.
 * Must be registered LAST in the Express middleware chain.
 *
 * Produces a consistent error envelope:
 * {
 *   "success": false,
 *   "message": "Human readable message",
 *   "code": "ERROR_CODE",
 *   "errors": []  // field-level errors when applicable
 * }
 */
function errorHandler(err, req, res, next) {
    // Default to 500 Internal Server Error
    const statusCode = err.statusCode || err.status || 500;

    const code = err.code || (statusCode === 404
        ? ERROR_CODES.NOT_FOUND
        : statusCode === 401
        ? ERROR_CODES.UNAUTHORIZED
        : statusCode === 403
        ? ERROR_CODES.FORBIDDEN
        : ERROR_CODES.INTERNAL_ERROR
    );

    // Don't leak internal error details in production
    const message = statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error';

    if (statusCode === 500) {
        console.error('[Error]', err);
    }

    res.status(statusCode).json({
        success: false,
        message,
        code,
        errors: err.errors || [],
    });
}

module.exports = { errorHandler };
