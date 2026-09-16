const express = require('express');
const { googleLogin, getCurrentUser, devLogin } = require('./auth.controller');
const { protect } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validation.middleware');
const { devLoginSchema } = require('../../../../../packages/validation/src/index');

const router = express.Router();

router.post('/google', googleLogin);
router.get('/me', protect, getCurrentUser);

if (process.env.NODE_ENV !== 'production') {
    router.post('/dev-login', validateBody(devLoginSchema), devLogin);
}

module.exports = router;