/**
 * Uploads controller — sign-upload endpoints.
 *
 * Spec ref: §2 principle 5 — backend signs, frontend uploads directly to
 * Cloudinary. Backend never proxies image bytes.
 */

const { signUpload, isConfigured } = require('../../lib/cloudinary');
const { ROLES } = require('../../lib/constants');
const { audit } = require('../../lib/audit');

/**
 * Allowed folders + their role policies. Adding a folder here is the only
 * way to mint a signed-upload payload — the backend refuses to sign
 * uploads to arbitrary folders (prevents abuse).
 */
const FOLDER_POLICY = {
  'menu-items': { roles: [ROLES.OUTLET_ADMIN, ROLES.SUPER_ADMIN] },
  'outlet-logos': { roles: [ROLES.OUTLET_ADMIN, ROLES.SUPER_ADMIN] },
  'students': { roles: [ROLES.STUDENT, ROLES.SUPER_ADMIN] }, // profile pictures
};

async function signMenuItemUpload(req, res, next) {
  try {
    if (!isConfigured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary env vars are not set',
        code: 'CLOUDINARY_NOT_CONFIGURED',
        errors: [],
      });
    }

    const { folder, publicId, tags } = req.body;
    if (!folder || !FOLDER_POLICY[folder]) {
      return res.status(400).json({
        success: false,
        message: `Invalid folder. Must be one of: ${Object.keys(FOLDER_POLICY).join(', ')}`,
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'folder', message: 'Invalid folder' }],
      });
    }

    // Role check against the folder policy
    const policy = FOLDER_POLICY[folder];
    if (!policy.roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload to this folder',
        code: 'FORBIDDEN',
        errors: [],
      });
    }

    // OUTLET_ADMIN can only upload to their own outlet's namespace
    const outletId = req.user.outletId || null;
    if (folder === 'menu-items' && folder === 'outlet-logos' && req.user.role === ROLES.OUTLET_ADMIN && !outletId) {
      return res.status(403).json({
        success: false,
        message: 'User is not assigned to an outlet',
        code: 'FORBIDDEN',
        errors: [],
      });
    }

    const payload = signUpload({ folder, publicId, tags, outletId });

    await audit({
      actorId: req.user.id,
      action: 'UPLOAD_SIGNED',
      targetType: 'Cloudinary',
      targetId: payload.publicId,
      after: { folder, publicId: payload.publicId },
      req,
    });

    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    next(error);
  }
}

module.exports = { signMenuItemUpload };
