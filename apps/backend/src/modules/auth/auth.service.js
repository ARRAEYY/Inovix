/**
 * Auth service — Google login, dev-login, current user, logout, refresh.
 *
 * All DB access via Prisma. Tokens issued/rotated via src/lib/tokens.js.
 */

const prisma = require('../../lib/prisma');
const { hashPassword, comparePassword } = require('../../utils/password');
const { USER_STATUS } = require('../../lib/constants');

// Outlet fields surfaced to the client (name/logo for the sidebar + profile).
const OUTLET_STAFF_INCLUDE = {
  outletStaff: { include: { outlet: { select: { id: true, name: true, logoUrl: true, location: true, status: true } } } },
  studentProfile: true,
};

async function findOrCreateGoogleUser(googleData) {
  const { googleId, email, name, picture } = googleData;
  const normalizedEmail = email.toLowerCase();

  let isNew = false;
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: OUTLET_STAFF_INCLUDE,
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        googleId,
        name: name || null,
        googlePicture: picture || null,
        onboardingCompleted: false,
        status: 'ACTIVE',
        // role defaults to STUDENT per schema
      },
      include: OUTLET_STAFF_INCLUDE,
    });
    isNew = true;
  } else if (!user.googleId) {
    // Link Google id to an existing user (e.g. admin pre-created them)
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, googlePicture: picture || null },
      include: OUTLET_STAFF_INCLUDE,
    });
  }

  return { user, isNew };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: OUTLET_STAFF_INCLUDE,
  });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return user;
}

async function devLogin({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: OUTLET_STAFF_INCLUDE,
  });

  if (!user) {
    const error = new Error('Dev user not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.passwordHash) {
    if (!password) {
      const error = new Error('Password is required');
      error.statusCode = 401;
      throw error;
    }
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }
  }

  if (user.status === USER_STATUS.SUSPENDED) {
    const error = new Error('Your account has been suspended');
    error.statusCode = 403;
    throw error;
  }

  // Update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}

async function passwordLogin({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: OUTLET_STAFF_INCLUDE,
  });

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (user.status === USER_STATUS.SUSPENDED) {
    const error = new Error('Your account has been suspended');
    error.statusCode = 403;
    throw error;
  }

  if (!user.passwordHash) {
    const error = new Error('This account signs in with Google OAuth. Please click "Continue with Google".');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}

module.exports = {
  findOrCreateGoogleUser,
  getCurrentUser,
  devLogin,
  passwordLogin,
};
