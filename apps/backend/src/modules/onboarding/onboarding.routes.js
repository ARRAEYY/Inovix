const express = require('express');
const { completeOnboarding } = require('./onboarding.controller');
const { protect } = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/', protect, completeOnboarding);

module.exports = router;
