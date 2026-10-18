const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const adminController = require('./admin.controller');
const { ROLES } = require('../../lib/constants');
const { validateBody, validateQuery } = require('../../middleware/validation.middleware');
const {
  updateUserStatusSchema,
  updateOutletStatusSchema,
  updateMenuAvailabilitySchema,
  refundCreateSchema,
  updateUserSchema,
  createUserSchema,
  updateOutletSchema,
  updateMenuItemSchema,
  createMenuItemSchema,
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
router.post('/users', validateBody(createUserSchema), adminController.createUser);
router.get('/users/:userId', adminController.getUser);
router.patch('/users/:userId/status', validateBody(updateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:userId', validateBody(updateUserSchema), adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);

router.get('/outlets', adminController.getOutlets);
router.post('/outlets', adminController.createOutlet);
router.get('/outlets/:outletId', adminController.getOutlet);
router.patch('/outlets/:outletId/status', validateBody(updateOutletStatusSchema), adminController.updateOutletStatus);
router.patch('/outlets/:outletId', validateBody(updateOutletSchema), adminController.updateOutlet);
router.delete('/outlets/:outletId', adminController.deleteOutlet);

router.get('/staff', adminController.getAllStaff);

router.get('/orders', validateQuery(z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
})), adminController.getOrders);
router.get('/orders/:orderId', adminController.getOrder);

// INO-P0-7 / INO-P0-8 / INO-P0-9: manual super-admin refund endpoint.
router.post('/refunds', validateBody(refundCreateSchema), adminController.issueManualRefund);

router.get('/menu', adminController.getMenu);
router.post('/menu', validateBody(createMenuItemSchema), adminController.createMenuItem);
router.get('/menu/:itemId', adminController.getMenuItem);
router.patch('/menu/:itemId/status', validateBody(updateMenuAvailabilitySchema), adminController.updateMenuItemStatus);
router.patch('/menu/:itemId', validateBody(updateMenuItemSchema), adminController.updateMenuItem);
router.delete('/menu/:itemId', adminController.deleteMenuItem);

router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

router.post('/maintenance/migrate', adminController.runSchemaSync);

module.exports = router;
