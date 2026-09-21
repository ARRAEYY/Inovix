/**
 * Onboarding service — first-time password setup + student profile.
 *
 * Called after Google login when `user.onboardingCompleted === false`.
 * Sets the password hash and creates the StudentProfile row.
 */

const prisma = require('../../lib/prisma');
const { hashPassword } = require('../../utils/password');

async function completeOnboarding(userId, payload) {
  const { password, profile } = payload;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.onboardingCompleted) {
    const error = new Error('User has already completed onboarding');
    error.statusCode = 409;
    throw error;
  }

  if (user.role !== 'STUDENT') {
    const error = new Error('Only students can complete onboarding');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(password);

  // Update user + create profile in a transaction
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        name: profile.fullName,
        onboardingCompleted: true,
      },
    });

    const sp = await tx.studentProfile.upsert({
      where: { userId },
      update: {
        fullName: profile.fullName,
        phone: profile.phone,
        course: profile.course,
        year: profile.year,
        collegeId: profile.collegeId,
        // INO-P1-29: renamed from verifiedAt — the value is the submission
        // timestamp, not a verification timestamp. If a real verification
        // flow is added later, use a separate `verifiedAt` column set
        // only when an admin/directory-check approves the profile.
        submittedAt: new Date(),
      },
      create: {
        userId,
        fullName: profile.fullName,
        phone: profile.phone,
        course: profile.course,
        year: profile.year,
        collegeId: profile.collegeId,
        submittedAt: new Date(),
      },
    });

    return { user: u, profile: sp };
  });

  return updated.user;
}

module.exports = { completeOnboarding };
