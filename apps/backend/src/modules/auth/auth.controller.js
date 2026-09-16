const { verifyGoogleCredential } = require('./google.service');
const { findOrCreateGoogleUser, getCurrentUser: getCurrentUserService } = require('./auth.service');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

async function googleLogin(req, res, next) {
    try {
        const { credential } = req.body;

        const googleUser = await verifyGoogleCredential(credential);
        const { user, isNew } = await findOrCreateGoogleUser(googleUser);

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ success: false, message: 'Your account has been suspended' });
        }

        const accessToken = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            message: isNew ? 'Google registration successful' : 'Google authentication successful',
            data: {
                user,
                accessToken
            }
        });
    } catch (error) {
        next(error);
    }
}

async function getCurrentUser(req, res, next) {
    try {
        const userId = req.user.id;
        const user = await getCurrentUserService(userId);

        return res.status(200).json({
            success: true,
            data: {
                user
            }
        });
    } catch (error) {
        next(error);
    }
}

async function devLogin(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, message: 'Not available in production' });
    }

    try {
        const { email } = req.body;
        const mockUsers = require('../../data/mockUsers');
        
        const user = mockUsers.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Dev user not found' });
        }

        if (req.body.password && user.passwordHash) {
            const { comparePassword } = require('../../utils/password');
            const isMatch = await comparePassword(req.body.password, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else if (req.body.password && !user.passwordHash) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ success: false, message: 'Your account has been suspended' });
        }

        const accessToken = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            message: 'Dev login successful',
            data: {
                user,
                accessToken
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    googleLogin,
    getCurrentUser,
    devLogin
};