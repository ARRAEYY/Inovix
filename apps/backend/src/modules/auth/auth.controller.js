const { verifyGoogleCredential } = require('./google.service');
const { findOrCreateGoogleUser, getCurrentUser: getCurrentUserService } = require('./auth.service');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

async function googleLogin(req, res, next) {
    try {
        const { credential } = req.body;

        const googleUser = await verifyGoogleCredential(credential);
        const { user, isNew } = await findOrCreateGoogleUser(googleUser);

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

module.exports = {
    googleLogin,
    getCurrentUser
};