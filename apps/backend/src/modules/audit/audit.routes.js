const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../lib/constants');
const { validateQuery } = require('../../middleware/validation.middleware');
const { z } = require('zod');
const { listAudit } = require('../../lib/audit');

const router = express.Router();

router.use(protect, authorizeRole(ROLES.SUPER_ADMIN));

router.get('/', validateQuery(z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  actorUserId: z.string().optional(),
  action: z.string().optional(),
})), async (req, res, next) => {
  try {
    const result = await listAudit(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
