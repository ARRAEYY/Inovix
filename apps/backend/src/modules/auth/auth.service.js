const mockUsers = require('../../data/mockUsers');
const { hashPassword } = require('../../utils/password');

async function registerUser({ name, email, password, role }) {
    const existingUser = mockUsers.find(
        user => user.email.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
        const error = new Error('Email already registered');
        error.statusCode = 409;
        throw error;
    }

    const passwordHash = await hashPassword(password);

    const user = {
        id: `user-${mockUsers.length + 1}`,
        name,
        email: email.toLowerCase(),
        passwordHash,
        role
    };

    mockUsers.push(user);

    const { passwordHash: _, ...safeUser } = user;

    return safeUser;
}

async function findOrCreateGoogleUser(googleData) {
    const { googleId, email, name, picture } = googleData;
    const normalizedEmail = email.toLowerCase();

    let existingUser = mockUsers.find(
        user => user.email.toLowerCase() === normalizedEmail
    );

    let isNew = false;

    if (!existingUser) {
        existingUser = {
            id: `user-${mockUsers.length + 1}`,
            googleId,
            email: normalizedEmail,
            name,
            picture,
            passwordHash: null,
            onboardingCompleted: false
        };
        mockUsers.push(existingUser);
        isNew = true;
    }

    const { passwordHash: _, ...safeUser } = existingUser;

    return { user: safeUser, isNew };
}

async function getCurrentUser(userId) {
    const user = mockUsers.find(u => u.id === userId);
    
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }
    
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
}

module.exports = {
    registerUser,
    findOrCreateGoogleUser,
    getCurrentUser
};