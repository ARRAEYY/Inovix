const express = require('express');
const { googleLogin, getCurrentUser } = require('./auth.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/google', googleLogin);
router.get('/me', authMiddleware, getCurrentUser);

module.exports = router;