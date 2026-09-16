const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const COLLEGE_EMAIL_DOMAIN = '.rishihood.edu.in';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyGoogleCredential(credential) {
    if (!credential) {
        const error = new Error('Google credential is required');
        error.statusCode = 400;
        throw error;
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (!payload) {
            const error = new Error('Invalid Google credential');
            error.statusCode = 401;
            throw error;
        }

        const email = payload.email?.toLowerCase();

        if (!email || !email.endsWith(COLLEGE_EMAIL_DOMAIN)) {
            const error = new Error('Only @rishihood.edu.in accounts are allowed');
            error.statusCode = 403;
            throw error;
        }

        if (!payload.email_verified) {
            const error = new Error('Google email is not verified');
            error.statusCode = 401;
            throw error;
        }

        return {
            googleId: payload.sub,
            email,
            name: payload.name,
            picture: payload.picture,
            emailVerified: payload.email_verified
        };
    } catch (error) {
        if (error.statusCode) {
            throw error;
        }

        const authError = new Error('Google authentication failed');
        authError.statusCode = 401;
        throw authError;
    }
}

module.exports = {
    verifyGoogleCredential
};