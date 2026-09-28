const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

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

// Construct the OAuth2Client with BOTH client ID + secret so it can do
// the server-side authorization-code exchange (the secret is required for
// `client.getToken(code)`). The ID-token-only verification flow (used by
// the GIS popup) also works with this client — it just ignores the secret.
const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

// ─── OAuth authorization-code redirect flow ───────────────────────────────
// The GIS popup flow (verifyGoogleCredential above) uses `storagerelay`
// internally and doesn't strictly need a redirect URI, BUT Google's OAuth
// client config in the Cloud Console often requires a registered redirect
// URI, AND the popup flow is fragile (popup blockers, FedCM failures,
// headless browsers, mobile). The redirect flow is more reliable.
//
// Flow:
//   1. Frontend: window.location.href = '/api/v1/auth/google'
//   2. Backend GET /auth/google: builds the Google OAuth URL with
//      redirect_uri=<origin>/api/v1/auth/google/callback, sets a state
//      cookie, 302-redirects to Google.
//   3. User picks an account on Google.
//   4. Google 302-redirects to <origin>/api/v1/auth/google/callback?code=...&state=...
//   5. Backend GET /auth/google/callback: exchanges the code for tokens
//      (requires GOOGLE_CLIENT_SECRET), verifies the ID token, creates the
//      user, sets the refresh cookie, redirects to the frontend.

const GOOGLE_OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
];

// Build the Google OAuth consent URL. `redirectUri` MUST match a URI
// registered under Authorized redirect URIs in the Google Cloud Console.
function getAuthUrl({ redirectUri, state }) {
    return client.generateAuthUrl({
        access_type: 'online', // we don't need refresh tokens from Google
        scope: GOOGLE_OAUTH_SCOPES,
        include_granted_scopes: true,
        prompt: 'select_account', // always show the account picker
        redirect_uri: redirectUri,
        state,
    });
}

// Exchange an authorization code for Google user info.
// 1. `client.getToken(code)` exchanges the code for tokens (uses the secret).
// 2. Extract the `id_token` from the token response.
// 3. `verifyIdToken` validates it (same path as the popup flow).
async function exchangeCodeForUser(code, redirectUri) {
    if (!code) {
        const error = new Error('Authorization code is required');
        error.statusCode = 400;
        throw error;
    }
    if (!GOOGLE_CLIENT_SECRET) {
        const error = new Error('GOOGLE_CLIENT_SECRET is not configured on the server');
        error.statusCode = 500;
        throw error;
    }

    let tokenResponse;
    try {
        const r = await client.getToken({
            code,
            redirect_uri: redirectUri,
        });
        tokenResponse = r.tokens;
    } catch (error) {
        const authError = new Error(`Google token exchange failed: ${error.message}`);
        authError.statusCode = 401;
        throw authError;
    }

    const idToken = tokenResponse?.id_token;
    if (!idToken) {
        const error = new Error('Google did not return an ID token');
        error.statusCode = 401;
        throw error;
    }

    // Reuse the existing ID-token verification (campus-domain gate, email
    // verified check, ALLOW_ANY_GOOGLE_EMAIL bypass) — single source of
    // truth for both flows.
    return verifyGoogleCredential(idToken);
}

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

        // Dev/test affordance: when ALLOW_ANY_GOOGLE_EMAIL=true, skip the
        // campus-domain gate so testers can log in with a regular Gmail
        // account. Production must keep this unset (or 'false') so only
        // @rishihood.edu.in accounts are accepted.
        if (process.env.ALLOW_ANY_GOOGLE_EMAIL !== 'true') {
            if (!isCollegeEmail(email)) {
                const error = new Error(`Only @${COLLEGE_EMAIL_DOMAIN} accounts are allowed`);
                error.statusCode = 403;
                throw error;
            }
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
    getAuthUrl,
    exchangeCodeForUser,
    // Exported for tests:
    _isCollegeEmail: isCollegeEmail,
    _COLLEGE_EMAIL_DOMAIN: COLLEGE_EMAIL_DOMAIN,
    _ALLOW_SUBDOMAINS: ALLOW_SUBDOMAINS,
};
