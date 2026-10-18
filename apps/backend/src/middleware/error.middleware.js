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
    // Ensure errors are never cached by browsers or CDNs
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Translate Prisma Client known request errors to user-friendly HTTP responses
    let statusCode = err.statusCode || err.status;
    let message = err.message || 'Internal server error';
    let code = err.code;

    if (err.code === 'P2003') {
        statusCode = 409;
        code = 'CONSTRAINT_VIOLATION';
        message = 'Cannot complete this action because other records depend on this item (such as orders or staff).';
    } else if (err.code === 'P2002') {
        statusCode = 409;
        code = 'UNIQUE_CONSTRAINT_VIOLATION';
        message = 'A record with this unique detail already exists.';
    } else if (err.code === 'P2025') {
        statusCode = 404;
        code = ERROR_CODES.NOT_FOUND;
        message = 'The requested record was not found.';
    } else {
        statusCode = statusCode || 500;
        code = code || (statusCode === 404
            ? ERROR_CODES.NOT_FOUND
            : statusCode === 401
            ? ERROR_CODES.UNAUTHORIZED
            : statusCode === 403
            ? ERROR_CODES.FORBIDDEN
            : ERROR_CODES.INTERNAL_ERROR
        );
    }

    // Don't leak internal unexpected errors in production, but allow operational messages
    if (statusCode === 500 && process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
    }

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
