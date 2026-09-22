const express = require('express');
const { googleLogin, getCurrentUser, devLogin, updateProfile } = require('./auth.controller');
const { protect } = require('../../middleware/auth.middleware');
const { validateBody } = require('../../middleware/validation.middleware');
const { z } = require('zod');
const devLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().optional()
});
const router = express.Router();

router.post('/google', googleLogin);
router.get('/me', protect, getCurrentUser);
router.put('/me', protect, updateProfile);

if (process.env.NODE_ENV !== 'production') {
    router.post('/dev-login', validateBody(devLoginSchema), devLogin);
}

module.exports = router;