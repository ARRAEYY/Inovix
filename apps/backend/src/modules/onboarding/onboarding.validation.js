function validateOnboarding(password, profile) {
    if (!password) {
        const error = new Error('Missing password');
        error.statusCode = 400;
        throw error;
    }

    if (typeof password !== 'string' || password.length < 6) {
        const error = new Error('Invalid password');
        error.statusCode = 400;
        throw error;
    }

    if (!profile) {
        const error = new Error('Missing profile data');
        error.statusCode = 400;
        throw error;
    }

    const { phone, course, year, collegeId } = profile;

    if (!phone) {
        const error = new Error('Missing phone number');
        error.statusCode = 400;
        throw error;
    }

    if (!course) {
        const error = new Error('Missing course');
        error.statusCode = 400;
        throw error;
    }

    if (!year) {
        const error = new Error('Missing year');
        error.statusCode = 400;
        throw error;
    }

    if (!collegeId) {
        const error = new Error('Missing college ID');
        error.statusCode = 400;
        throw error;
    }
}

module.exports = {
    validateOnboarding
};
