/**
 * Auth service — Google login, dev-login, current user, logout, refresh.
 *
 * All DB access via Prisma. Tokens issued/rotated via src/lib/tokens.js.
 */

const prisma = require('../../lib/prisma');
const { hashPassword, comparePassword } = require('../../utils/password');
const { USER_STATUS } = require('../../lib/constants');

async function findOrCreateGoogleUser(googleData) {
  const { googleId, email, name, picture } = googleData;
  const normalizedEmail = email.toLowerCase();

  let isNew = false;
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { outletStaff: true, studentProfile: true },
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
      include: { outletStaff: true, studentProfile: true },
    });
    isNew = true;
  } else if (!user.googleId) {
    // Link Google id to an existing user (e.g. admin pre-created them)
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, googlePicture: picture || null },
      include: { outletStaff: true, studentProfile: true },
    });
  }

  return { user, isNew };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { outletStaff: true, studentProfile: true },
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
    include: { outletStaff: true, studentProfile: true },
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

module.exports = {
  findOrCreateGoogleUser,
  getCurrentUser,
  devLogin,
};
