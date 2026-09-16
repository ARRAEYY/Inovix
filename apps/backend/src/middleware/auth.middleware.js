const jwt = require('jsonwebtoken');
const mockUsers = require('../data/mockUsers');
const { ROLES, USER_STATUS, ERROR_CODES } = require('../lib/constants');

const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast at startup if JWT_SECRET is not configured
if (!JWT_SECRET) {
    throw new Error(
        '[auth.middleware] JWT_SECRET environment variable is required. ' +
        'Set it in your .env file. See .env.example for reference.'
    );
}

function protect(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        error.code = ERROR_CODES.UNAUTHORIZED;
        return next(error);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Always look up the current user record — never trust JWT-embedded role/status
        const user = mockUsers.find(u => u.id === decoded.id);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 401;
            error.code = ERROR_CODES.UNAUTHORIZED;
            return next(error);
        }

        if (user.status === USER_STATUS.SUSPENDED) {
            const error = new Error('Your account has been suspended');
            error.statusCode = 401;
            error.code = ERROR_CODES.ACCOUNT_SUSPENDED;
            return next(error);
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            outletId: user.outletId || null,
        };

        next();
    } catch (err) {
        const error = new Error('Invalid or expired authentication token');
        error.statusCode = 401;
        error.code = ERROR_CODES.UNAUTHORIZED;
        next(error);
    }
}

function authorizeRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            const error = new Error('You do not have permission to access this area.');
            error.statusCode = 403;
            error.code = ERROR_CODES.FORBIDDEN;
            return next(error);
        }
        next();
    };
}

module.exports = { protect, authorizeRole };
