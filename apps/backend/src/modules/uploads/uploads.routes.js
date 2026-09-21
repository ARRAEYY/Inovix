const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const { uploadSignSchema } = require('@nosh/validation');
const { signMenuItemUpload } = require('./uploads.controller');

const router = express.Router();

// All signed-upload endpoints require authentication.
// OUTLET_ADMIN can upload for own outlet; SUPER_ADMIN can upload anywhere.
router.use(protect);

router.post(
  '/sign',
  authorizeRole(ROLES.OUTLET_ADMIN, ROLES.SUPER_ADMIN, ROLES.STUDENT),
  validateBody(uploadSignSchema),
  signMenuItemUpload
);

module.exports = router;
