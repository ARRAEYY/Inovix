const mockUsers = require('../../data/mockUsers');
const { hashPassword } = require('../../utils/password');

async function completeOnboarding(userId, payload) {
    const { password, profile } = payload;

    const userIndex = mockUsers.findIndex(user => user.id === userId);

    if (userIndex === -1) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    const user = mockUsers[userIndex];

    if (user.onboardingCompleted) {
        const error = new Error('User has already completed onboarding');
        error.statusCode = 409;
        throw error;
    }

    const passwordHash = await hashPassword(password);
    const { phone, course, year, collegeId } = profile;

    const updatedUser = {
        ...user,
        passwordHash,
        phone,
        course,
        year,
        collegeId,
        onboardingCompleted: true
    };

    mockUsers[userIndex] = updatedUser;

    const { passwordHash: _, ...safeUser } = updatedUser;

    return safeUser;
}

module.exports = {
    completeOnboarding
};
