const jwt = require('jsonwebtoken');
const mockUsers = require('../data/mockUsers');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

function protect(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Load fresh user data
        const user = mockUsers.find(u => u.id === decoded.id);
        if (!user) {
            throw new Error('User not found');
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role || 'STUDENT',
            outletId: user.outletId || null
        };
        
        next();
    } catch (err) {
        const error = new Error('Invalid or expired authentication token');
        error.statusCode = 401;
        next(error);
    }
}

function authorizeRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            const error = new Error('You do not have permission to access this area.');
            error.statusCode = 403;
            return next(error);
        }
        next();
    };
}

module.exports = { protect, authorizeRole };
