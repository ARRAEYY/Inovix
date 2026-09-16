const express = require('express');
const { completeOnboarding } = require('./onboarding.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/', authMiddleware, completeOnboarding);

module.exports = router;
