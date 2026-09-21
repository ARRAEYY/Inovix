const express = require('express');
const { protect, authorizeRole, requireOutletScope } = require('../../middleware/auth.middleware');
const menuController = require('./menu.controller');
const { OUTLET_ROLES, OUTLET_ADMIN_ROLES } = require('../../lib/constants');
const { validateBody } = require('../../middleware/validation.middleware');
const { menuItemCreateSchema, menuItemUpdateSchema } = require('@nosh/validation');

const router = express.Router();

// Menu viewing: both OUTLET_STAFF and OUTLET_ADMIN
router.get('/', protect, authorizeRole(...OUTLET_ROLES), requireOutletScope, menuController.getOutletMenu);
router.get('/:itemId', protect, authorizeRole(...OUTLET_ROLES), requireOutletScope, menuController.getMenuItem);

// Menu management (create/update/delete): OUTLET_ADMIN only
router.post('/', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, validateBody(menuItemCreateSchema), menuController.createMenuItem);
router.patch('/:itemId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, validateBody(menuItemUpdateSchema), menuController.updateMenuItem);
router.delete('/:itemId', protect, authorizeRole(...OUTLET_ADMIN_ROLES), requireOutletScope, menuController.deleteMenuItem);

module.exports = router;
