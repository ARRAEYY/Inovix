const onboardingService = require('./onboarding.service');
const { audit } = require('../../lib/audit');

async function completeOnboarding(req, res, next) {
  try {
    const userId = req.user.id;
    const updatedUser = await onboardingService.completeOnboarding(userId, req.body);

    await audit({
      actorId: userId,
      action: 'USER_ONBOARDED',
      targetType: 'User',
      targetId: userId,
      after: { onboardingCompleted: true },
      req,
    });

    const { passwordHash, ...safe } = updatedUser;
    return res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: { user: safe },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { completeOnboarding };
