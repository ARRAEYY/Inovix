const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// ─── INO-008 fix: read COLLEGE_EMAIL_DOMAIN from env (was hardcoded) ───────
// The .env.example already documented `COLLEGE_EMAIL_DOMAIN=.rishihood.edu.in`
// but the previous implementation ignored the env var and hardcoded
// `.rishihood.edu.in`. Changing the env value did nothing — a configuration
// correctness bug.
//
// ─── INO-009 fix: normalize + use domain equality (not endsWith) ───────────
// The previous check was `email.endsWith(COLLEGE_EMAIL_DOMAIN)`. With the
// default value `.rishihood.edu.in` that's safe (blocks
// `attacker@evilrishihood.edu.in`), but if an operator changed the env to
// `rishihood.edu.in` (no leading dot) then `attacker@notrishihood.edu.in`
// would pass — a suffix-match bypass.
//
// Fix: parse the env value, treat a leading dot as "subdomains allowed",
// lowercase-normalize, and compare the actual domain portion (the
// substring after '@') for *equality* (or proper subdomain equality).
const RAW_COLLEGE_EMAIL_DOMAIN = process.env.COLLEGE_EMAIL_DOMAIN || '.rishihood.edu.in';
const ALLOW_SUBDOMAINS = RAW_COLLEGE_EMAIL_DOMAIN.startsWith('.');
const COLLEGE_EMAIL_DOMAIN = ALLOW_SUBDOMAINS
    ? RAW_COLLEGE_EMAIL_DOMAIN.slice(1).toLowerCase()
    : RAW_COLLEGE_EMAIL_DOMAIN.toLowerCase();

function isCollegeEmail(email) {
    if (!email) return false;
    const at = email.lastIndexOf('@');
    if (at === -1 || at === email.length - 1) return false;
    const domain = email.slice(at + 1).toLowerCase();
    if (ALLOW_SUBDOMAINS) {
        // Subdomain mode (".rishihood.edu.in" or "rishihood.edu.in" entered with a
        // leading dot): exact match OR proper-suffix `.rishihood.edu.in`.
        return domain === COLLEGE_EMAIL_DOMAIN || domain.endsWith('.' + COLLEGE_EMAIL_DOMAIN);
    }
    // Exact-match mode (no leading dot): only that exact domain.
    return domain === COLLEGE_EMAIL_DOMAIN;
}

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

        if (!isCollegeEmail(email)) {
            const error = new Error(`Only @${COLLEGE_EMAIL_DOMAIN} accounts are allowed`);
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
    verifyGoogleCredential,
    // Exported for tests:
    _isCollegeEmail: isCollegeEmail,
    _COLLEGE_EMAIL_DOMAIN: COLLEGE_EMAIL_DOMAIN,
    _ALLOW_SUBDOMAINS: ALLOW_SUBDOMAINS,
};
