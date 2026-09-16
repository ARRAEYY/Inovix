const express = require('express');
const { protect, authorizeRole } = require('../../middleware/auth.middleware');
const adminController = require('./admin.controller');
const { ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const { 
  updateUserStatusSchema, 
  updateOutletStatusSchema, 
  updateMenuAvailabilitySchema 
} = require('../../../../../packages/validation/src/index');

const router = express.Router();

// All admin routes require SUPER_ADMIN role
router.use(protect, authorizeRole(ROLES.SUPER_ADMIN));

router.get('/overview', adminController.getOverview);

router.get('/users', adminController.getUsers);
router.get('/users/:userId', adminController.getUser);
router.patch('/users/:userId/status', validateBody(updateUserStatusSchema), adminController.updateUserStatus);

router.get('/outlets', adminController.getOutlets);
router.get('/outlets/:outletId', adminController.getOutlet);
router.patch('/outlets/:outletId/status', validateBody(updateOutletStatusSchema), adminController.updateOutletStatus);

router.get('/orders', adminController.getOrders);
router.get('/orders/:orderId', adminController.getOrder);

router.get('/menu', adminController.getMenu);
router.get('/menu/:itemId', adminController.getMenuItem);
router.patch('/menu/:itemId/status', validateBody(updateMenuAvailabilitySchema), adminController.updateMenuItemStatus);

module.exports = router;
