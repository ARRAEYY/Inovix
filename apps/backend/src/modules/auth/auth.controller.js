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
const { verifyGoogleCredential } = require('./google.service');
const {
  findOrCreateGoogleUser,
  getCurrentUser: getCurrentUserService,
  devLogin: devLoginService,
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

function stripSensitive(user) {
  if (!user) return null;
  const { passwordHash, googleId, ...safe } = user;
  return {
    ...safe,
    outletId: user.outletStaff?.outletId || null,
    outletRole: user.outletStaff?.role || null,
  };
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

async function devLogin(req, res, next) {
  // INO-007 fix: belt-and-suspenders guard at the controller level.
  // The route is only mounted when NODE_ENV=development AND
  // ENABLE_DEV_LOGIN=true (see auth.routes.js). Re-check here in case
  // the controller is wired directly somewhere else.
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.ENABLE_DEV_LOGIN !== 'true'
  ) {
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
    // INO-P1-20 fix: same as /refresh — only accept the cookie, not body.
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    clearRefreshCookie(res);
    // Optional: revoke all sessions for this user (more aggressive)
    // await revokeAllForUser(req.user.id);

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

module.exports = {
  googleLogin,
  devLogin,
  getCurrentUser,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
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
