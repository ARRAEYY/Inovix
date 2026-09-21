const express = require('express');
const { completeOnboarding } = require('./onboarding.controller');
const { protect } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validation.middleware');
const { onboardingSchema } = require('@nosh/validation');

const router = express.Router();

router.post('/', protect, validateBody(onboardingSchema), completeOnboarding);

module.exports = router;
