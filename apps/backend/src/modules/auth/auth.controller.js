/**
 * Auth controller — endpoints for Google login, dev-login, current user,
 * refresh, and logout.
 *
 * Token model (spec §3.2 Layer 1):
 *   - access token: 15 min, sent in response body
 *   - refresh token: 7 days, rotating; stored only in an httpOnly cookie
 *
 * Refresh rotation: each refresh can be used exactly once. Re-use of an
 * already-rotated refresh triggers token-theft detection and revokes all
 * the user's refresh tokens.
 */

const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const { hashToken } = require('../../lib/tokens');
const { hashPassword } = require('../../utils/password');
const { sendPasswordResetOTP } = require('../../lib/email');
const { audit } = require('../../lib/audit');
const { verifyGoogleCredential, getAuthUrl, exchangeCodeForUser } = require('./google.service');
const {
  findOrCreateGoogleUser,
  getCurrentUser: getCurrentUserService,
  devLogin: devLoginService,
  passwordLogin: passwordLoginService,
} = require('./auth.service');
const {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
} = require('../../lib/tokens');
const { USER_STATUS } = require('../../lib/constants');

const REFRESH_COOKIE = 'nosh_refresh';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, REFRESH_COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_OPTIONS, maxAge: undefined });
}

// Serialize a user for API responses. Role-aware: only includes the fields
// relevant to the user's role, so a student doesn't get a response full of
// `outlet: null` / `outletId: null` / `outletRole: null` / `outletStaff: null`
// noise. Strips `passwordHash`, `googleId`, `googlePicture` (the picture is
// exposed as the frontend-facing `avatar` alias), and the raw `outletStaff`
// Prisma relation (which leaks internal IDs the frontend doesn't need).
//
// Shape per role:
//   STUDENT      → core + studentProfile (if present)
//   OUTLET_STAFF → core + outletId + outletRole + outlet (the linked outlet)
//   OUTLET_ADMIN → core + outletId + outletRole + outlet
//   SUPER_ADMIN  → core only (no outlet, no studentProfile)
function stripSensitive(user) {
  if (!user) return null;
  // Drop secrets + the raw Prisma relations we re-shape below.
  const {
    passwordHash,
    googleId,
    googlePicture,
    outletStaff,
    studentProfile: rawStudentProfile,
    ...core
  } = user;

  // `avatar` is the frontend-facing alias of the stored Google picture.
  const base = {
    ...core,
    avatar: googlePicture || null,
  };

  // Role-specific fields — only present when relevant.
  if (user.role === 'OUTLET_STAFF' || user.role === 'OUTLET_ADMIN') {
    if (outletStaff?.outlet) {
      return {
        ...base,
        outletId: outletStaff.outletId,
        outletRole: outletStaff.role,
        outlet: {
          id: outletStaff.outlet.id,
          name: outletStaff.outlet.name,
          logoUrl: outletStaff.outlet.logoUrl,
          location: outletStaff.outlet.location,
          status: outletStaff.outlet.status,
        },
      };
    }
    // Outlet staff with no linked outlet (rare edge case) — still surface
    // the IDs so the frontend can tell them apart from students.
    return {
      ...base,
      outletId: outletStaff?.outletId || null,
      outletRole: outletStaff?.role || null,
    };
  }

  if (user.role === 'STUDENT' && rawStudentProfile) {
    return {
      ...base,
      studentProfile: {
        id: rawStudentProfile.id,
        fullName: rawStudentProfile.fullName,
        phone: rawStudentProfile.phone,
        course: rawStudentProfile.course,
        year: rawStudentProfile.year,
        collegeId: rawStudentProfile.collegeId,
        submittedAt: rawStudentProfile.submittedAt,
      },
    };
  }

  // SUPER_ADMIN, or STUDENT without a completed profile, or any other role —
  // just the core fields. No outlet/student noise.
  return base;
}

async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;
    const googleUser = await verifyGoogleCredential(credential);
    const { user, isNew } = await findOrCreateGoogleUser(googleUser);

    if (user.status === USER_STATUS.SUSPENDED) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended',
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user, { req });

    await audit({
      actorId: user.id,
      action: isNew ? 'USER_GOOGLE_REGISTER' : 'USER_GOOGLE_LOGIN',
      targetType: 'User',
      targetId: user.id,
      req,
    });

    setRefreshCookie(res, refreshToken);
    return res.status(200).json({
      success: true,
      message: isNew ? 'Google registration successful' : 'Google authentication successful',
      data: {
        user: stripSensitive(user),
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── OAuth authorization-code redirect flow ───────────────────────────────
// GET /api/v1/auth/google — kick off Google OAuth via redirect (more
// reliable than the GIS popup). Builds the consent URL with a redirect_uri
// derived from the request's forwarded host (so it works behind the
// Next.js reverse-proxy + the preview ALB without per-session env tweaks),
// sets a `google_oauth_state` httpOnly cookie for CSRF, and 302-redirects
// to Google.
const OAUTH_STATE_COOKIE = 'google_oauth_state';
const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  path: '/api/v1/auth',
  maxAge: 10 * 60 * 1000, // 10 minutes — OAuth round-trip shouldn't take this long
};

// Reconstruct the public origin from X-Forwarded-* headers (set by the
// Next.js reverse-proxy / Caddy / ALB). Falls back to the direct request
// scheme + host when no proxy is in front (e.g. local dev hitting port
// 4000 directly).
function publicOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || req.get('host');
  return `${proto}://${host}`;
}

async function googleAuthStart(req, res, next) {
  try {
    // redirect_uri MUST exactly match a URI registered under Authorized
    // redirect URIs in the Google Cloud Console. We build it from the
    // request's public origin so the same backend works for local dev
    // (http://localhost:3000), the Next.js proxy, and the preview ALB
    // (https://preview-chat-*.space-z.ai) — as long as the operator
    // registered each origin's callback URL.
    const redirectUri = `${publicOrigin(req)}/api/v1/auth/google/callback`;
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, OAUTH_STATE_COOKIE_OPTIONS);
    const url = getAuthUrl({ redirectUri, state });
    return res.redirect(url);
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/auth/google/callback — Google redirects here with
// ?code=...&state=... (or ?error=... on user-cancel). Verify the state
// cookie (CSRF), exchange the code for tokens, find/create the user, set
// the refresh cookie, then 302-redirect to the frontend. The frontend's
// AuthContext detects `?google_login=success` and refreshes the access
// token via /auth/refresh.
async function googleCallback(req, res, next) {
  const FRONTEND_PATH = process.env.GOOGLE_OAUTH_FRONTEND_PATH
    || (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.split(',')[0].trim()}/` : '/inovix-app/');

  // User cancelled or Google errored — bounce back to the login page
  // with an error flag the frontend can show.
  if (req.query.error) {
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v1/auth' });
    return res.redirect(`${FRONTEND_PATH}?google_login=error&reason=${encodeURIComponent(String(req.query.error))}`);
  }

  const code = req.query.code;
  const state = req.query.state;
  const cookieState = req.cookies[OAUTH_STATE_COOKIE];

  // CSRF: the state returned by Google must match the cookie we set in
  // googleAuthStart. A mismatch (or missing cookie) = potential CSRF /
  // replay attack — reject and redirect to the login page.
  if (!state || !cookieState || state !== cookieState) {
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v1/auth' });
    return res.redirect(`${FRONTEND_PATH}?google_login=error&reason=state_mismatch`);
  }

  try {
    const redirectUri = `${publicOrigin(req)}/api/v1/auth/google/callback`;
    const googleUser = await exchangeCodeForUser(code, redirectUri);
    const { user, isNew } = await findOrCreateGoogleUser(googleUser);

    if (user.status === USER_STATUS.SUSPENDED) {
      res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v1/auth' });
      return res.redirect(`${FRONTEND_PATH}?google_login=error&reason=suspended`);
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user, { req });

    await audit({
      actorId: user.id,
      action: isNew ? 'USER_GOOGLE_REGISTER' : 'USER_GOOGLE_LOGIN',
      targetType: 'User',
      targetId: user.id,
      req,
    });

    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v1/auth' });
    setRefreshCookie(res, refreshToken);
    // The refresh cookie (httpOnly, SameSite=None; Secure) lets the frontend
    // refresh the access token later — BUT third-party cookie blocking
    // (Safari ITP, Chrome's phase-out, Firefox ETP) may prevent it from being
    // sent on the cross-site /auth/refresh call. So we ALSO pass the access
    // token in a URL hash fragment (#at=<jwt>). Hash fragments are NOT sent
    // to servers in HTTP requests (so they don't leak via referrer headers)
    // and the frontend's AuthContext reads it on load + cleans the URL
    // immediately via history.replaceState. The token is short-lived (15m)
    // so even if the URL is shared before cleanup, the exposure window is
    // tiny. This is the standard SPA OAuth implicit-flow pattern.
    return res.redirect(
      `${FRONTEND_PATH}?google_login=success#at=${encodeURIComponent(accessToken)}`,
    );
  } catch (error) {
    const reason = encodeURIComponent(error.message || 'google_callback_failed');
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v1/auth' });
    return res.redirect(`${FRONTEND_PATH}?google_login=error&reason=${reason}`);
  }
}

async function devLogin(req, res, next) {
  // INO-007 fix: belt-and-suspenders guard at the controller level.
  // The route is only mounted when NODE_ENV=development AND
  // ENABLE_DEV_LOGIN=true (see auth.routes.js). Re-check here in case
  // the controller is wired directly somewhere else.
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEV_LOGIN !== 'true') {
    return res.status(403).json({
      success: false,
      message: 'Dev login is disabled',
    });
  }

  try {
    const user = await devLoginService(req.body);
    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user, { req });

    await audit({
      actorId: user.id,
      action: 'USER_DEV_LOGIN',
      targetType: 'User',
      targetId: user.id,
      req,
    });

    setRefreshCookie(res, refreshToken);
    return res.status(200).json({
      success: true,
      message: 'Dev login successful',
      data: {
        user: stripSensitive(user),
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const user = await getCurrentUserService(req.user.id);
    return res.status(200).json({
      success: true,
      data: { user: stripSensitive(user) },
    });
  } catch (error) {
    next(error);
  }
}

// PUT /auth/me — self-service profile update. The frontend profile editor
// sends { name, avatar }; only fields that exist on the User model are
// persisted (avatar is stored in googlePicture, the model's picture column).
async function updateCurrentUser(req, res, next) {
  try {
    const { name, avatar } = req.body;
    const data = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
        return res.status(400).json({ success: false, message: 'Name must be a non-empty string (max 120 chars)' });
      }
      data.name = name.trim();
    }
    if (avatar !== undefined) {
      if (avatar !== null && (typeof avatar !== 'string' || avatar.length > 2048)) {
        return res.status(400).json({ success: false, message: 'Avatar must be a URL string' });
      }
      data.googlePicture = avatar || null;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: { outletStaff: { include: { outlet: { select: { id: true, name: true, logoUrl: true, location: true, status: true } } } }, studentProfile: true },
    });

    await audit({
      actorId: req.user.id,
      action: 'USER_PROFILE_UPDATED',
      targetType: 'User',
      targetId: req.user.id,
      after: { name: user.name },
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: { user: stripSensitive(user) },
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    // INO-P1-20 fix: the refresh token is ONLY accepted from the httpOnly
    // cookie (`nosh_refresh`). The previous implementation also accepted
    // `req.body.refreshToken` as a fallback — a second API path that
    // put the long-lived credential into JSON, defeating the security
    // benefit of the httpOnly cookie (any JS-readable client could use
    // the body path). The frontend was migrated to cookies in d173314,
    // so the body fallback is no longer needed.
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      const error = new Error('Refresh session is required');
      error.statusCode = 400;
      throw error;
    }

    const result = await rotateRefreshToken(refreshToken, { req });
    if (!result) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    setRefreshCookie(res, result.refreshToken);
    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: {
        user: stripSensitive(result.user),
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    if (req.user?.id) {
      await revokeAllForUser(req.user.id);
    }
    clearRefreshCookie(res);

    await audit({
      actorId: req.user?.id,
      action: 'USER_LOGOUT',
      targetType: 'User',
      targetId: req.user?.id,
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await passwordLoginService(req.body);
    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user, { req });

    await audit({
      actorId: user.id,
      action: 'USER_LOGIN',
      targetType: 'User',
      targetId: user.id,
      req,
    });

    setRefreshCookie(res, refreshToken);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: stripSensitive(user),
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Change password (while logged in) ──────────────────────────────────
// Body: { oldPassword, newPassword }
// Verifies the old password (if the user has one — Google-only users have
// passwordHash=null, so they can't use this; they should use forgot-password
// or set a password via onboarding).
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Old password and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.passwordHash) {
      return res.status(400).json({ success: false, message: 'This account uses Google OAuth. Use "Forgot Password" to set a password.' });
    }
    const { comparePassword } = require('../../utils/password');
    const isMatch = await comparePassword(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    const { hashPassword } = require('../../utils/password');
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    await audit({ actorId: user.id, action: 'USER_PASSWORD_CHANGED', targetType: 'User', targetId: user.id, req });
    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  login,
  googleLogin,
  googleAuthStart,
  googleCallback,
  devLogin,
  getCurrentUser,
  updateCurrentUser,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};

/**
 * Forgot Password — generates a 6-digit OTP, stores the hash in the
 * PasswordReset table (expires in 10 min), and sends the OTP via email.
 *
 * In dev mode (no SMTP configured), the OTP is logged to the console
 * so you can test without real email credentials.
 *
 * Rate limited: one OTP per email per 60 seconds (prevents spam).
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Don't reveal whether the email exists (security — prevent user enumeration)
    // Always return success, but only send OTP if the user exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists for that email, a reset code has been sent.',
      });
    }

    // Rate limit: check if an OTP was sent in the last 60 seconds
    const recentOtp = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) }, // last 60 seconds
      },
    });
    if (recentOtp) {
      return res.status(429).json({
        success: false,
        message: 'A reset code was recently sent. Please wait 60 seconds before requesting another.',
      });
    }

    // Generate 6-digit OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = hashToken(otp); // SHA-256 hash

    // Store in DB (expires in 10 min)
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      },
    });

    // Send OTP via email (or log to console in dev mode)
    const name = user.name || '';
    await sendPasswordResetOTP(user.email, otp, name);

    // Audit
    await audit({
      actorId: null,
      action: 'PASSWORD_RESET_OTP_SENT',
      targetType: 'User',
      targetId: user.id,
      after: { email: user.email },
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'If an account exists for that email, a reset code has been sent.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset Password — validates the OTP, sets the new password.
 *
 * The OTP must be valid (matches the hash), not expired, and not already used.
 * On success, the PasswordReset row is marked as used, the user's passwordHash
 * is updated, and all refresh tokens are revoked (force re-login on all devices).
 */
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP code, and new password are all required',
      });
    }

    // Validate password strength (same rules as onboarding)
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the most recent valid OTP for this user
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'No valid reset code found. Please request a new code.',
      });
    }

    // Validate OTP hash
    const otpHash = hashToken(otp);
    if (otpHash !== resetRecord.otpHash) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code. Please check and try again.',
      });
    }

    // Mark OTP as used
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    // Update password
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens (force re-login on all devices)
    const { revokeAllForUser } = require('../../lib/tokens');
    await revokeAllForUser(user.id);

    // Audit
    await audit({
      actorId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'User',
      targetId: user.id,
      req: null,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}
