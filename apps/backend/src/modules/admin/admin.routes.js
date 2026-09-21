const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const adminController = require('./admin.controller');
const { ROLES } = require('../../lib/constants');
const { validateBody, validateQuery } = require('../../middleware/validation.middleware');
const {
  updateUserStatusSchema,
  updateOutletStatusSchema,
  updateMenuAvailabilitySchema,
} = require('@nosh/validation');
const { z } = require('zod');

const router = express.Router();

// All admin routes require SUPER_ADMIN role
router.use(protect, authorizeRole(ROLES.SUPER_ADMIN));

router.get('/overview', adminController.getOverview);

router.get('/users', validateQuery(z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
})), adminController.getUsers);
router.get('/users/:userId', adminController.getUser);
router.patch('/users/:userId/status', validateBody(updateUserStatusSchema), adminController.updateUserStatus);

router.get('/outlets', adminController.getOutlets);
router.get('/outlets/:outletId', adminController.getOutlet);
router.patch('/outlets/:outletId/status', validateBody(updateOutletStatusSchema), adminController.updateOutletStatus);

router.get('/orders', validateQuery(z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
})), adminController.getOrders);
router.get('/orders/:orderId', adminController.getOrder);

router.get('/menu', adminController.getMenu);
router.get('/menu/:itemId', adminController.getMenuItem);
router.patch('/menu/:itemId/status', validateBody(updateMenuAvailabilitySchema), adminController.updateMenuItemStatus);

module.exports = router;
