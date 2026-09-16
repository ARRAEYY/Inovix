const onboardingService = require('./onboarding.service');
const { validateOnboarding } = require('./onboarding.validation');

async function completeOnboarding(req, res, next) {
    try {
        const userId = req.user.id;
        const { password, profile } = req.body;

        validateOnboarding(password, profile);

        const updatedUser = await onboardingService.completeOnboarding(userId, { password, profile });

        return res.status(200).json({
            success: true,
            message: 'Onboarding completed successfully',
            data: {
                user: updatedUser
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    completeOnboarding
};
